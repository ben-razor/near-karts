import { useState, useEffect, useCallback, Fragment } from 'react';
import Logo from './images/logo-1.png';
import './scss/styles.scss';
import { useToasts } from 'react-toast-notifications';
import * as nearAPI from 'near-api-js';
import BrButton from './js/components/lib/BrButton';
import { initContract } from './js/helpers/near';
import BlokBots from './js/components/BlokBots';
import { SketchPicker } from 'react-color';

const TOAST_TIMEOUT = 4000;
const NEAR_ENV='testnet';
const BOATLOAD_OF_GAS = '30000000000000';
const viewMethods = ['nft_tokens_for_owner', 'nft_get_strange_juice'];
const changeMethods = ['drink_strange_juice', 'do_action'];

function App() {
  const [ messages, setMessages ] = useState();
  const [ message, setMessage] = useState('');
  const [contract, setContract] = useState();
  const [currentUser, setCurrentUser] = useState();
  const [nearConfig, setNearConfig] = useState();
  const [wallet, setWallet] = useState();
  const [nftContract, setNFTContract] = useState();
  const [nftRes, setNFTRes] = useState();
  const [strangeJuice, setStrangeJuice] = useState({});
  const [processingActions, setProcessingActions] = useState({});

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
        await initContract(NEAR_ENV, 'nft1.benrazor.testnet');

        console.log('connecting 2');
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

  const connectNFT = useCallback(async () => {
    console.log('connecting nft');
    const _nftContract = await new nearAPI.Contract(
      // User's accountId as a string
      wallet.account(),
      // accountId of the contract we will be loading
      // NOTE: All contracts on NEAR are deployed to an account and
      // accounts can only have one contract deployed to them.
      'nft1.benrazor.testnet',
      {
        viewMethods, changeMethods, sender: wallet.getAccountId(),
      }
    );

    setNFTContract(_nftContract);
  }, [wallet]);

  useEffect(() => {
    if(wallet) {
      connectNFT();
    }
  }, [wallet, connectNFT]);

  const signIn = () => {
    if(wallet.isSignedIn()) {
      wallet.signOut();
      setWallet();
    }
    else {
      wallet.requestSignIn(
        {contractId: 'nft1.benrazor.testnet', methodNames: changeMethods }, //contract requesting access
        'Strange Juice', //optional name
        null, //optional URL to redirect to if the sign in was successful
        null //optional URL to redirect to if the sign in was NOT successful
      );
    }
    setWallet(wallet);
  };

  async function execute(action) {
    if(!processingActions[action]) {
      const tokenId = nftRes?.[0].token_id;

      let _processingActions = {...processingActions };
      _processingActions[action] = true;
      setProcessingActions(_processingActions);

      if(action === 'drink_strange_juice') {
        await nftContract.drink_strange_juice({ token_id: tokenId }, BOATLOAD_OF_GAS, '0');
      }
      else {
        await nftContract.do_action({ token_id: tokenId, action }, BOATLOAD_OF_GAS, '0');
      }

      let tokensForOwnerRes = await nftContract.nft_tokens_for_owner({ account_id: wallet.getAccountId()});

      delete _processingActions[action];
      setProcessingActions(_processingActions);

      setNFTRes(tokensForOwnerRes);
    }
  }

  useEffect(() => {
    if(nftContract) {
      (async () => {
        let res = await nftContract.nft_tokens_for_owner({ account_id: wallet.getAccountId()});
        setNFTRes(res);
      })();
    }
  }, [nftContract, wallet]);

  useEffect(() => {
    if(nftRes) {
      (async () => {
        const tokenId = nftRes[0].token_id;
        let strangeJuice = await nftContract.nft_get_strange_juice({ token_id: tokenId });
        setStrangeJuice(strangeJuice);
      })();
    }
  }, [nftRes, nftContract]);
  
  console.log(strangeJuice);
  const isGlowing = strangeJuice.evolution;
  const color1 = isGlowing;

  return (
    <div className="br-page">
      <div className="br-header">
        <div className="br-title-panel">
          <img className="br-header-logo" alt="Ben Razor Head" src={Logo} />
          <h1 className="br-title">Blok Bots</h1>
        </div>

      </div>
      <div className="br-content">
        <div className="br-threejs-container">
          <BlokBots isGlowing={isGlowing} color1={color1} execute={execute} strangeJuice={strangeJuice} 
                    processingActions={processingActions} />
        </div>
        { 
          <Fragment>
            <BrButton label={wallet?.isSignedIn() ? "Sign out" : "Sign in"} id="signIn" className="br-button br-icon-button" onClick={signIn} />
            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} />
            <BrButton label="Connect NFT" id="connectNFT" className="br-button br-icon-button" onClick={connectNFT} />
          </Fragment>
        }
      </div>
    </div>
  );
}

export default App;
