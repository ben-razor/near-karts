import { useState, useEffect, useCallback, Fragment } from 'react';
import Logo from './images/logo-1.png';
import * as Tone from 'tone';
import './scss/styles.scss';
import { useToasts } from 'react-toast-notifications';
import * as nearAPI from 'near-api-js';
import BrButton from './js/components/lib/BrButton';
import { initNear } from './js/helpers/near';
import NearKarts from './js/components/NearKarts';
import getText from './data/world/text';
import { getRandomInt } from "./js/helpers/math";
import { base58_to_binary } from 'base58-js'

const TOAST_TIMEOUT = 4000;
const NEAR_ENV='testnet';
const BOATLOAD_OF_GAS = '30000000000000';

const nearkartsAddress = 'nearkarts.benrazor.testnet';
const nearContractConfig = {
  'nearkarts.benrazor.testnet': {
    viewMethods: [
      'nft_tokens_for_owner', 'nft_get_near_kart', 'nft_get_token_metadata', 
      'get_num_karts', 'get_token_id_by_index', 'get_last_battle'
    ],
    changeMethods: [
      'nft_mint', 'nft_configure', 'nft_update_media', 'game_simple_battle',
      'nft_mint_with_verified_image'
    ]
  }
}

function App() {
  const [contract, setContract] = useState();
  const [currentUser, setCurrentUser] = useState();
  const [nearConfig, setNearConfig] = useState();
  const [nearProvider, setNearProvider] = useState();
  const [wallet, setWallet] = useState();
  const [mightBeSignedIn, setMightBeSignedIn] = useState(true);
  const [nftContract, setNFTContract] = useState();
  const [nftList, setNFTList] = useState([]);
  const [nftData, setNFTData] = useState({});
  const [nftMetadata, setNFTMetadata] = useState({});
  const [activeTokenId, setActiveTokenId] = useState('');
  const [activeKart, setActiveKart] = useState('');
  const [processingActions, setProcessingActions] = useState({});
  const [audioInitialized, setAudioInitialized] = useState();
  const [battleResult, setBattleResult] = useState({});
  const [battleKarts, setBattleKarts] = useState([]);
  const [lastBattle, setLastBattle] = useState({});

  const { addToast } = useToasts();

  function toast(message, type='info') {
    addToast(message, { 
      appearance: type,
      autoDismiss: true,
      autoDismissTimeout: TOAST_TIMEOUT
    });
  }

  function doubleToast(message1, message2, type='info') {
    toast( <Fragment><div>{message1}</div><div>{message2}</div></Fragment>, type)
  }

  const connect = useCallback(async() => {
    (async () => {
      console.log('connecting');
      let { currentUser, nearConfig, walletConnection, provider } = 
        await initNear(NEAR_ENV, '.benrazor.testnet');

      setContract(contract);
      setCurrentUser(currentUser);
      setNearConfig(nearConfig);
      console.log('wallet', walletConnection);
      setWallet(walletConnection);
      setNearProvider(provider);
    })();
  }, [contract]);

  useEffect(() => {
    const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();
    console.log('ks', keyStore);
    connect();
  }, [connect]);

  const connectNFT = useCallback(async (contractAddress) => {
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
        setNFTData({});
        setNFTList([]);
        setActiveTokenId(0);
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

        if(!name) {
          doubleToast(getText('error_mint_kart'), getText('error_no_kart_name'), 'warning');
        }
        else {
          let tokenId = name + Date.now().toString();

          try {
            await nftContract.nft_mint({
              token_id: tokenId,
              receiver_id: wallet.getAccountId(),
              token_metadata: {
                title: `A NEAR Kart Called ${name}`, description: "From the NEAR Karts series",
                media: "https://bafkreiczuqqsxcbkv2ins2m4wmcgdxmlzm5gcld4yc4bcln26s4kgfo3ha.ipfs.dweb.link/", 
                copies: 1
              },
              near_kart_new: data.nftData
            }, BOATLOAD_OF_GAS, pointOneNear.toString());

            reloadTokens = true;
          } catch(e) {
            toast(getText('error_mint_kart'), 'error');
          }
        }
      }
      else if(action === 'saveKart') {
        try {
          let tokenId = activeTokenId;
          if(!tokenId) {
            doubleToast(getText('error_save_kart'), getText('error_no_active_kart'), 'error');
          }
          else {
            await nftContract.nft_configure({ token_id: tokenId, near_kart_new: data }, BOATLOAD_OF_GAS, '0');
            toast(getText('success_save_kart'));
            reloadTokens = true;
          }
        }
        catch(e) {
          toast(getText('error_save_kart'), 'error');
          console.log(e);
        }
      }
      else if(action === 'addImageToNFT') {
        try {
          let tokenId = activeTokenId;
          if(!tokenId) {
            doubleToast(getText('error_save_kart'), getText('error_no_active_kart'), 'error');
          }
          else {
            await nftContract.nft_update_media({ 
              token_id: tokenId, 
              cid: data.cid,
              sig: data.sigHex,
              pub_key: data.pubKeyHex
            }, BOATLOAD_OF_GAS, '0');

            toast(getText('success_save_kart'));
            let _tokenMetadata = await nftContract.nft_get_token_metadata({ token_id: tokenId});
            setNFTMetadata(_tokenMetadata);
            reloadTokens = true;
          }
        }
        catch(e) {
          toast(getText('error_save_kart'), 'error');
          console.log(e);
        }
      }
      else if(action === 'getOpponent') {
        let tokenId = activeTokenId;
        if(!tokenId) {
          toast(getText('error_no_active_kart'), 'error');
        }
        else {
          let numKarts = await nftContract.get_num_karts();
          let randIndex = getRandomInt(0, numKarts - 1);
          let opponentId = await nftContract.get_token_id_by_index({ index: randIndex });
          if(opponentId === tokenId) {
            randIndex = randIndex === numKarts - 1 ? 0 : randIndex + 1;
            opponentId = await nftContract.get_token_id_by_index({ index: randIndex });
          }

          let homeMetadata = await nftContract.nft_get_token_metadata({ token_id: tokenId });
          homeMetadata.token_id = tokenId;
          let awayMetadata = await nftContract.nft_get_token_metadata({ token_id: opponentId });
          awayMetadata.token_id = opponentId;
          setBattleKarts([homeMetadata, awayMetadata]);
        }
      }
      else if(action === 'gameSimpleBattle') {
        try {
          let tokenId = activeTokenId;
          if(!tokenId) {
            toast(getText('error_no_active_kart'), 'error');
          }
          else if(!data.opponentTokenId) {
            toast(getText('error_no_opponent_selected'), 'error');
          }
          else if(tokenId === data.opponentTokenId) {
            toast(getText('error_no_battle_self'), 'error');
          }
          else {
            let result = await nftContract.game_simple_battle({ 
              token_id: tokenId, 
              opponent_token_id: data.opponentTokenId,
            }, BOATLOAD_OF_GAS, '0');

            let homeKart = await nftContract.nft_get_near_kart({ token_id: result.home_token_id });
            let awayKart = await nftContract.nft_get_near_kart({ token_id: result.away_token_id });

            let homeMetadata = await nftContract.nft_get_token_metadata({ token_id: result.home_token_id });
            let awayMetadata = await nftContract.nft_get_token_metadata({ token_id: result.away_token_id });

            result.karts = [homeKart, awayKart];
            result.metadata = [homeMetadata, awayMetadata];
            setBattleResult(result);

            toast(getText('text_battle_started'));
          }
        }
        catch(e) {
          toast(getText('error_starting_battle'), 'error');
          console.log(e);
        }
      }
      else if(action === 'selectNFT') {
        setActiveTokenId(data);
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
        let _nftList = await nftContract.nft_tokens_for_owner({ account_id: wallet.getAccountId()});
        if(_nftList.length && !activeTokenId) {
          setActiveTokenId(_nftList[0].token_id);
        }
        setNFTList(_nftList);
      })();
    }
  }, [nftContract, wallet]);

  const selectNFT = useCallback(tokenId => {
    (async () => {
      for(let token of nftList) {
        if(token.token_id === tokenId) {
          let nftData = await nftContract.nft_get_near_kart({ token_id: tokenId });
          setNFTData(nftData);
          setActiveKart(token);
        }
      }

      try {
        let _lastBattle = await nftContract.get_last_battle({ account_id: wallet.getAccountId()});

        let homeMetadata = await nftContract.nft_get_token_metadata({ token_id: _lastBattle.home_token_id });
        homeMetadata.token_id = _lastBattle.home_token_id;
        let awayMetadata = await nftContract.nft_get_token_metadata({ token_id: _lastBattle.away_token_id });
        awayMetadata.token_id = _lastBattle.away_token_id;
        _lastBattle.homeMetadata = homeMetadata;
        _lastBattle.awayMetadata = awayMetadata;

        setLastBattle(_lastBattle);
      }
      catch(e) {
        console.log('Error loading last battle', e);
      }
    })();
  }, [nftList, nftContract, wallet]);

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
  }, [nftList, activeTokenId, selectNFT]);

  function getIntroPanel() {
    let ui = <div className="br-intro-panel">
      <div className="br-intro">
        <div className="br-intro-section">
          Humanity is in peril
        </div>
        <div className="br-intro-section">
          Many disagreements reign
        </div>
        <div className="br-intro-section">
          To settle this we battle... in NEAR Karts!
        </div>
        <div className="br-intro-section">
          Own your Karts. Win your battles. Humanity will be saved.
        </div>
      </div>
      <Fragment>
        <BrButton label={wallet?.isSignedIn() ? "Sign out" : "Sign in"} id="signIn" className="br-button br-icon-button" onClick={signIn} />
      </Fragment>
    </div>

    return ui;
  }

  useEffect(() => {
    if(audioInitialized) {
      const synth = new Tone.PolySynth(Tone.Synth).toDestination();
      const now = Tone.now()
      synth.triggerAttack("D4", now);
      synth.triggerAttack("F4", now + 0.5);
      synth.triggerAttack("A4", now + 1);
      synth.triggerAttack("C5", now + 1.5);
      synth.triggerAttack("E5", now + 2);
      synth.triggerRelease(["D4", "F4", "A4", "C5", "E5"], now + 4);
      const feedbackDelay = new Tone.FeedbackDelay(0.33, 0.8).toDestination();
      synth.connect(feedbackDelay);
    }
  }, [audioInitialized]);

  async function startAudio() {
    await Tone.start();
    setAudioInitialized(true);
  }

  console.log('nftList', nftList);
  console.log('nftData', nftData);
  console.log('nftMetadata', nftMetadata);

  useEffect(() => {
    if(nearProvider) {
      (async () => {
        let txId = 'EDnphqX53ad8Rnb8g5vvaBHYtTCLoQsoNXNneemBm8mC';
        let txIdBytes = base58_to_binary(txId);
        let rt = await nearProvider.txStatus(txIdBytes, 'benrazor.testnet'); 
        let r = await nearProvider.txStatusReceipts(txIdBytes, 'benrazor.testnet'); 
        let rs = await nearProvider.txStatusString(txIdBytes, 'benrazor.testnet'); 
        console.log('tx status', rt);
        console.log('tx status receipts', r);
        console.log('tx status string', rs);
      })();
    }
  }, [nearProvider]);

  console.log('Last battle: ', lastBattle);

  return (
    <div className="br-page">
      <div className="br-header">
        <div className="br-header-logo-panel">
          <img className="br-header-logo" alt="Ben Razor Head" src={Logo} />
        </div>
        <div className="br-header-title-panel">
          <h1 className="br-header-title">NEAR Karts</h1>
        </div>
        <div className="br-header-controls-panel">
          <div className="br-header-controls">
            <BrButton label="Start Audio" id="startAudio" className="br-button br-icon-button" onClick={startAudio} />
            <Fragment>
              <BrButton label={wallet?.isSignedIn() ? "Sign out" : "Sign in"} id="signIn" className="br-button br-icon-button" onClick={signIn} />
            </Fragment>
          </div>
        </div>
      </div>
      <div className="br-content">
        { (wallet?.isSignedIn() && mightBeSignedIn) ?
            <NearKarts nftList={nftList} nftData={nftData} nftMetadata={nftMetadata} selectNFT={selectNFT} activeTokenId={activeTokenId} activeKart={activeKart}
                       processingActions={processingActions} execute={execute} toast={toast} 
                       battleResult={battleResult} battleKarts={battleKarts} lastBattle={lastBattle} />
            :
            ''
        }
        { !wallet?.isSignedIn() ? getIntroPanel() : '' }
      </div>
    </div>
  );
}

export default App;
