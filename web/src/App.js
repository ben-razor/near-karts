/* global BigInt */
import { useState, useEffect, useCallback, Fragment } from 'react';
import Logo from './images/near-karts-1.png';
import * as Tone from 'tone';
import './scss/styles.scss';
import { toast as toasty } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as nearAPI from 'near-api-js';
import BrButton from './js/components/lib/BrButton';
import { initNear } from './js/helpers/near';
import NearKarts from './js/components/NearKarts';
import getText from './data/world/text';
import bigInt from 'big-integer';
import Modal from 'react-modal';

const TOAST_TIMEOUT = 4000;
const NEAR_ENV='testnet';
const BOATLOAD_OF_GAS = '100000000000000';

const nearkartsAddress = 'nearkarts1.benrazor.testnet';
const nearContractConfig = {
  [nearkartsAddress]: {
    viewMethods: [
      'nft_tokens_for_owner', 'nft_get_near_kart', 'nft_get_token_metadata', 
      'get_num_karts', 'get_token_id_by_index', 'get_last_battle'
    ],
    changeMethods: [
      'nft_mint', 'upgrade', 'game_simple_battle'
    ]
  }
}

const SCREENS = {
  garage: 1,
  battleSetup: 2,
  battle: 3
};

function App() {
  const [ modalIsOpen, setModalIsOpen ] = useState(false);
  const [contract, setContract] = useState();
  const [currentUser, setCurrentUser] = useState();
  const [nearConfig, setNearConfig] = useState();
  const [nearProvider, setNearProvider] = useState();
  const [wallet, setWallet] = useState();
  const [walletSignedIn, setWalletSignedIn] = useState(true);
  const [nftContract, setNFTContract] = useState();
  const [nftList, setNFTList] = useState([]);
  const [nftData, setNFTData] = useState({});
  const [nftMetadata, setNFTMetadata] = useState({});
  const [activeTokenId, setActiveTokenId] = useState();
  const [activeKart, setActiveKart] = useState('');
  const [processingActions, setProcessingActions] = useState({});
  const [audioInitialized, setAudioInitialized] = useState();
  const [battleResult, setBattleResult] = useState({});
  const [battleKarts, setBattleKarts] = useState([]);
  const [battleConfig, setBattleConfig] = useState({});
  const [lastBattle, setLastBattle] = useState({});
  const [screen, setScreen] = useState(SCREENS.garage);

  function toast(message, type='info') {
    console.log('toasty ', message);
    toasty[type](message, { 
      position: "top-right",
      autoClose: TOAST_TIMEOUT,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: 'dark'
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
        setWalletSignedIn(false);
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

      let nearPenny = bigInt(10).pow(bigInt(22));
      let pointOneNear = nearPenny.times(bigInt(10));

      if(action === 'mintWithImage') {
        console.log('mwi', data);
        console.log('mwi', data.nftData);
        let name = data.name.slice(0, 32);

        if(!name) {
          doubleToast(getText('error_mint_kart'), getText('error_no_kart_name'), 'warning');
        }
        else {
          let tokenId = name.replace(/\s+/g, '') + Date.now().toString();

          try {
            await nftContract.nft_mint({
              token_id: tokenId,
              receiver_id: wallet.getAccountId(),
              name,
              near_kart_new: data.nftData,
              cid: data.cid,
              sig: data.sigHex,
              pub_key: data.pubKeyHex
            }, BOATLOAD_OF_GAS, pointOneNear.toString());

            reloadTokens = true;
          } catch(e) {
            toast(getText('error_mint_kart'), 'error');
          }
        }
      }
      if(action === 'upgrade') {
        console.log('upgrade', data);
        console.log('upgrade', data.nftData);

        if(data.nftData.locked) {
          toast(getText('error_upgrade_kart_locked', 'warning'));
        }
        else {
          let tokenId = activeTokenId;
          if(!tokenId) {
            doubleToast(getText('error_save_kart'), getText('error_no_active_kart'), 'error');
          }
          else {
            try {
              await nftContract.upgrade({
                token_id: tokenId,
                near_kart_new: data.nftData,
                cid: data.cid,
                sig: data.sigHex,
                pub_key: data.pubKeyHex
              }, BOATLOAD_OF_GAS, pointOneNear.toString());

              reloadTokens = true;
            } catch(e) {
              toast(getText('error_upgrade_kart'), 'error');
              console.log(e);
            }
          }
        }
      }
      else if(action === 'gameSimpleBattle') {
        try {
          let tokenId = activeTokenId;
          if(!tokenId) {
            toast(getText('error_no_active_kart'), 'error');
          }
          else {
            let result = await nftContract.game_simple_battle({ 
              token_id: tokenId, 
            }, BOATLOAD_OF_GAS, '0');

            let homeKart = await nftContract.nft_get_near_kart({ token_id: result.home_token_id });
            let awayKart = await nftContract.nft_get_near_kart({ token_id: result.away_token_id });

            let homeMetadata = await nftContract.nft_get_token_metadata({ token_id: result.home_token_id });
            let awayMetadata = await nftContract.nft_get_token_metadata({ token_id: result.away_token_id });

            result.karts = [homeKart, awayKart];
            result.metadata = [homeMetadata, awayMetadata];
            setLastBattle(result);
            viewBattle(result);
            reloadTokens = true;
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
          let _tokenMetadata = await nftContract.nft_get_token_metadata({ token_id: tokenId});
          setNFTMetadata(_tokenMetadata);
          setActiveKart(token);
        }
      }
    })();
  }, [nftList, nftContract, wallet]);

  useEffect(() => {
    (async () => {
      try {
        let result = await nftContract.get_last_battle({ account_id: wallet.getAccountId()});

        let homeKart = await nftContract.nft_get_near_kart({ token_id: result.home_token_id });
        let awayKart = await nftContract.nft_get_near_kart({ token_id: result.away_token_id });

        let homeMetadata = await nftContract.nft_get_token_metadata({ token_id: result.home_token_id });
        let awayMetadata = await nftContract.nft_get_token_metadata({ token_id: result.away_token_id });

        result.karts = [homeKart, awayKart];
        result.metadata = [homeMetadata, awayMetadata];

        setLastBattle(result);
      }
      catch(e) {
        console.log('Error loading last battle', e);
      }
    })();
  }, [nftContract, wallet]);

  useEffect(() => {
    if(nftList.length) {
      console.log('ATID', activeTokenId);
      if(activeTokenId) {
        for(let nft of nftList) {
          if(nft.token_id === activeTokenId) {
            selectNFT(nft.token_id);
          }
        }
      }
      else {
        if(activeTokenId !== 'new_kart') {
          selectNFT(nftList[0].token_id);
        }
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
          Many disagreements are reported
        </div>
        <div className="br-intro-section">
          To settle this we battle... in NEAR Karts!
        </div>
        <div className="br-intro-section">
          Own your Karts. Win your battles. Humanity will be saved.
        </div>
      </div>
      <Fragment>
        <BrButton label={wallet?.isSignedIn() ? "Sign out" : "Sign in"} id="signIn" className="br-button" onClick={signIn} />
      </Fragment>
      <div className="br-front-screen-image"></div>
      <div className="br-intro-section">
        NEAR Karts are NFTs on the NEAR Blockchain
      </div>
    </div>

    return ui;
  }

  function kartName(kartTitle) {
    kartTitle = kartTitle || '';
    return kartTitle.replace('A NEAR Kart Called ', '');
  }

  function viewBattle(battle) {
    setBattleConfig(battle);
    console.log('lbk', battle.karts);
    setBattleKarts(battle.metadata);
    setScreen(SCREENS.battleSetup);
  }

  function getLastBattleUI() {
    let lastBattleUI;

    if(lastBattle && lastBattle.metadata) {
      lastBattleUI = <div className="br-last-battle-panel">
        <div className="br-last-battle-details">
          Last Battle:&nbsp; 
          { kartName(lastBattle.metadata[0].title) } v { kartName(lastBattle.metadata[1].title) }
        </div>
        <BrButton label="View" id="viewBattle" className="br-button" 
                  onClick={ e => viewBattle(lastBattle) }
                  isSubmitting={processingActions['viewBattle']} />
      </div>
    }

    return lastBattleUI;
  }


  function getHelpText() {
    let ui;

    ui = <div className="br-help-panel">
      <div className="br-help-line">{ getText('text_help_welcome') }</div>
      <div className="br-help-line">{ getText('text_help_garage') }</div>
      <div className="br-help-line">{ getText('text_help_mint') }</div>
      <h3 className="br-help-title">{ getText('text_help_battle_title') }</h3>
      <div className="br-help-line">{ getText('text_help_battle') }</div>
      <div className="br-help-line">{ getText('text_help_level_up') }</div>
      <div className="br-help-line">{ getText('text_help_upgrade') }</div>
      <div className="br-help-highlight">{ getText('text_help_kart_name') }</div>
    </div>

    return ui;
  }

  const customStyles = {
    content: {
      top: '50%',
      left: '50%',
      right: 'auto',
      bottom: 'auto',
      marginRight: '-50%',
      transform: 'translate(-50%, -50%)',
      borderRadius: '8px 8px 0 0',
      padding: 0
    },
    overlay: {zIndex: 999}
  };

  function openModal() {
    setModalIsOpen(true);
  }

  function afterOpenModal() {

  }

  function closeModal() {
    setModalIsOpen(false);
  }

  function showModal(id) {
    openModal();
  }

  console.log('nftList', nftList);
  console.log('nftData', nftData);
  console.log('nftMetadata', nftMetadata);
  console.log('Last battle: ', lastBattle);

  let isSignedIn = wallet?.isSignedIn() && walletSignedIn;  // NEAR sign out doesn't have await so need this trick with walletSignedIn 

  return (
    <div className="br-page">
      <div>
        <Modal
          isOpen={modalIsOpen}
          onAfterOpen={afterOpenModal}
          onRequestClose={closeModal}
          style={customStyles}
          contentLabel="NEAR Karts"
        >
          <div className="br-modal-title">
            <h2 className="br-modal-heading">NEAR Karts</h2>
            <div className="br-modal-close">
              <BrButton label={<i className="fas fa-times-circle" />} className="br-button br-icon-button" 
                          onClick={closeModal} />
            </div>
          </div>
          <div className="br-modal-panel">
            <div className="br-modal-content>">
              { getHelpText('introduction') } 
            </div>
          </div>
        </Modal>
      </div>
      <div className="br-header">
        <div className="br-header-logo-panel">
          { isSignedIn && screen !== SCREENS.battle ? getLastBattleUI() : ''}
        </div>
        <div className="br-header-title-panel">
          <img className="br-header-logo" alt="Ben Razor Head" src={Logo} />
        </div>
        <div className="br-header-controls-panel">
          <div className="br-header-controls">
            { isSignedIn ?
              <Fragment>
                <BrButton label={wallet?.isSignedIn() ? "Sign out" : "Sign in"} id="signIn" className="br-button" onClick={signIn} />
              </Fragment>
              :
              ''
            } 
          </div>
        </div>
      </div>
      <div className="br-content">
        { isSignedIn ?
            <NearKarts nftList={nftList} nftData={nftData} nftMetadata={nftMetadata} selectNFT={selectNFT} 
                       setNFTData={setNFTData}
                       activeTokenId={activeTokenId} setActiveTokenId={setActiveTokenId} activeKart={activeKart}
                       processingActions={processingActions} execute={execute} toast={toast} 
                       battleResult={battleResult} battleKarts={battleKarts} lastBattle={lastBattle} 
                       setBattleResult={setBattleResult} battleConfig={battleConfig} setBattleConfig={setBattleConfig}
                       SCREENS={SCREENS} screen={screen} setScreen={setScreen} 
                       showModal={showModal} />
            :
            ''
        }
        { !wallet?.isSignedIn() ? getIntroPanel() : '' }
      </div>
    </div>
  );
}

export default App;
