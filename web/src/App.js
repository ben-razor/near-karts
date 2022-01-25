import { useState, useEffect, useCallback, Fragment } from 'react';
import Logo from './images/logo-1.png';
import './scss/styles.scss';
import { useToasts } from 'react-toast-notifications';
import * as nearAPI from 'near-api-js';
import BrButton from './js/components/lib/BrButton';
import { initNear } from './js/helpers/near';
import BlokBots from './js/components/BlokBots';
import { SketchPicker } from 'react-color';

const TOAST_TIMEOUT = 4000;
const NEAR_ENV='testnet';
const BOATLOAD_OF_GAS = '30000000000000';

const nearkartsAddress = 'nearkarts.benrazor.testnet';
const nearContractConfig = {
  'nearkarts.benrazor.testnet': {
    viewMethods: ['nft_tokens_for_owner', 'nft_get_near_karts'],
    changeMethods: ['nft_mint', 'nft_configure']
  }
}

function App() {
  const [ messages, setMessages ] = useState();
  const [ message, setMessage] = useState('');
  const [contract, setContract] = useState();
  const [currentUser, setCurrentUser] = useState();
  const [nearConfig, setNearConfig] = useState();
  const [wallet, setWallet] = useState();
  const [nftContract, setNFTContract] = useState();
  const [nftRes, setNFTRes] = useState([]);
  const [activeTokenId, setActiveTokenId] = useState(0);
  const [nftData, setNFTData] = useState([]);
  const [processingActions, setProcessingActions] = useState({});
  const [mightBeSignedIn, setMightBeSignedIn] = useState(true);

  const { addToast } = useToasts();

  function toast(message, type='info') {
    addToast(message, { 
      appearance: type,
      autoDismiss: true,
      autoDismissTimeout: TOAST_TIMEOUT
    });
  }

  const connect = useCallback(async() => {
    (async () => {
      console.log('connecting');
      let { currentUser, nearConfig, walletConnection } = 
        await initNear(NEAR_ENV, '.benrazor.testnet');

      setContract(contract);
      setCurrentUser(currentUser);
      setNearConfig(nearConfig);
      console.log('wallet', walletConnection);
      setWallet(walletConnection);
    })();
  }, [contract]);

  useEffect(() => {
    const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();
    console.log('ks', keyStore);
    connect();
  }, [connect]);

  const connectNFT = useCallback(async (contractAddress) => {
    console.log('connecting nft');
    const { viewMethods, changeMethods } = nearContractConfig[contractAddress];
    const _nftContract = await new nearAPI.Contract(
      wallet.account(),
      contractAddress,
      {
        viewMethods, changeMethods, sender: wallet.getAccountId(),
      }
    );

    setNFTContract(_nftContract);
  }, [wallet]);

  useEffect(() => {
    if(wallet && wallet?.isSignedIn()) {
      connectNFT(nearkartsAddress);
    }
  }, [wallet, connectNFT]);

  const signIn = () => {
    if(wallet?.isSignedIn()) {
      (async () => {
        wallet.signOut();
        setMightBeSignedIn(false);
      })();
    }
    else {
      const { changeMethods } = nearContractConfig[nearkartsAddress];

      wallet.requestSignIn(
        {contractId: nearkartsAddress, methodNames: changeMethods }, //contract requesting access
        'NEAR Karts', //optional name
        null, //optional URL to redirect to if the sign in was successful
        null //optional URL to redirect to if the sign in was NOT successful
      );
      setWallet(wallet);
    }
  };

  async function execute(action, data) {
    if(!processingActions[action]) {
      let _processingActions = {...processingActions };
      _processingActions[action] = true;
      setProcessingActions(_processingActions);

      let nearPenny = (10n**22n);
      let pointOneNear = nearPenny * 10n;

      /*
'{"token_id": "1", "receiver_id": "benrazor.testnet", 
"token_metadata": { "title": "Ben Razor Logo Colors", "description": "The Ben Razor logo in color", 
"media": "https://bafkreiczuqqsxcbkv2ins2m4wmcgdxmlzm5gcld4yc4bcln26s4kgfo3ha.ipfs.dweb.link/", 
"copies": 1}}' 
--accountId nft1.benrazor.testnet --deposit 0.1
      */


      if(action === 'mint') {
        let name = data.name.slice(0, 32);
        let tokenId = name + Date.now().toString();

        console.log('pre mint');
        let res = await nftContract.nft_mint({
          token_id: tokenId,
          receiver_id: wallet.getAccountId(),
          token_metadata: {
            title: `A NEAR Kart Called ${name}`, description: "From the NEAR Karts series",
            media: "https://bafkreiczuqqsxcbkv2ins2m4wmcgdxmlzm5gcld4yc4bcln26s4kgfo3ha.ipfs.dweb.link/", 
            copies: 1
          }
        }, BOATLOAD_OF_GAS, pointOneNear.toString());
        console.log('post mint', res);
      }
      else if(action === 'configure') {
        await nftContract.configure_nft({ token_id: activeTokenId, near_kart_new: data}, BOATLOAD_OF_GAS, '0');
      }

      let tokensForOwnerRes = await nftContract.nft_tokens_for_owner({ account_id: wallet.getAccountId()});

      delete _processingActions[action];
      setProcessingActions(_processingActions);

      setNFTRes(tokensForOwnerRes);
    }
  }

  useEffect(() => {
    if(nftContract && wallet && wallet.getAccountId()) {
      (async () => {
        let res = await nftContract.nft_tokens_for_owner({ account_id: wallet.getAccountId()});
        setNFTRes(res);
      })();
    }
  }, [nftContract, wallet]);

  function selectNFT(tokenId) {
    (async () => {
      for(let token of nftRes) {
        if(token.token_id === tokenId) {
          let nftData = await nftContract.nft_get_near_kart({ token_id: tokenId });
          setNFTData(nftData);
          setActiveTokenId(tokenId);
        }
      }
    })();
  }

  console.log('nftRes', nftRes);
  console.log('nftData', nftData);
  console.log('wallet', wallet, wallet?.isSignedIn())

  return (
    <div className="br-page">
      <div className="br-header">
        <div className="br-title-panel">
          <img className="br-header-logo" alt="Ben Razor Head" src={Logo} />
          <h1 className="br-title">NEAR Karts</h1>
        </div>

      </div>
      <div className="br-content">
        { (wallet?.isSignedIn() && mightBeSignedIn) &&
            <div className="br-threejs-container">
              <BlokBots nftRes={nftRes} nftData={nftData} selectNFT={selectNFT}
                        processingActions={processingActions} execute={execute} />
            </div>
        }
        { 
          <Fragment>
            <BrButton label={wallet?.isSignedIn() ? "Sign out" : "Sign in"} id="signIn" className="br-button br-icon-button" onClick={signIn} />
          </Fragment>
        }
      </div>
    </div>
  );
}

export default App;
