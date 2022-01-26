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
    viewMethods: ['nft_tokens_for_owner', 'nft_get_near_kart'],
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
  const [nftList, setNFTList] = useState([]);
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
      let reloadTokens = false;

      let nearPenny = (10n**22n);
      let pointOneNear = nearPenny * 10n;

      if(action === 'mint') {
        let name = data.name.slice(0, 32);
        let tokenId = name + Date.now().toString();

        await nftContract.nft_mint({
          token_id: tokenId,
          receiver_id: wallet.getAccountId(),
          token_metadata: {
            title: `A NEAR Kart Called ${name}`, description: "From the NEAR Karts series",
            media: "https://bafkreiczuqqsxcbkv2ins2m4wmcgdxmlzm5gcld4yc4bcln26s4kgfo3ha.ipfs.dweb.link/", 
            copies: 1
          }
        }, BOATLOAD_OF_GAS, pointOneNear.toString());

        reloadTokens = true;
      }
      else if(action === 'configure') {
        await nftContract.configure_nft({ token_id: activeTokenId, near_kart_new: data}, BOATLOAD_OF_GAS, '0');
        reloadTokens = true;
      }
      else if(action === 'selectNFT') {
        selectNFT(data);
      }

      if(reloadTokens) {
        let tokensForOwnerRes = await nftContract.nft_tokens_for_owner({ account_id: wallet.getAccountId()});
        setNFTList(tokensForOwnerRes);
      }

      delete _processingActions[action];
      setProcessingActions(_processingActions);

    }
  }

  useEffect(() => {
    if(nftContract && wallet && wallet.getAccountId()) {
      (async () => {
        let res = await nftContract.nft_tokens_for_owner({ account_id: wallet.getAccountId()});
        setNFTList(res);
      })();
    }
  }, [nftContract, wallet]);

  useEffect(() => {
    if(nftList.length) {
      if(activeTokenId) {
        for(let nft of nftList) {
          if(nft.token_id === activeTokenId) {
            selectNFT(nft.token_id);
          }
        }
      }
      else {
        selectNFT(nftList[0].token_id);
      }
    }
  }, [nftList]);

  function selectNFT(tokenId) {
    (async () => {
      for(let token of nftList) {
        if(token.token_id === tokenId) {
          let nftData = await nftContract.nft_get_near_kart({ token_id: tokenId });
          setNFTData(nftData);
          setActiveTokenId(tokenId);
        }
      }
    })();
  }

  console.log('nftList', nftList);
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
              <BlokBots nftList={nftList} nftData={nftData} selectNFT={selectNFT} activeTokenId={activeTokenId}
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
