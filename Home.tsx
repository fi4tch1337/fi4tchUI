import { useEffect, useState } from "react";
import styled from "styled-components";
import Countdown from "react-countdown";
import { Button, CircularProgress, Grid, Snackbar } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";

import * as anchor from "@project-serum/anchor";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletDialogButton } from "@solana/wallet-adapter-material-ui";

import {
  CandyMachine,
  awaitTransactionSignatureConfirmation,
  getCandyMachineState,
  mintOneToken,
  shortenAddress,
} from "./candy-machine";

const ConnectButton = styled(WalletDialogButton)``;

const HomeContainer = styled.div`
  position: relative;
  background-color: rgba(0, 0, 0, 0.2);
  min-height: 100vh;
  width: 100%;
`;

const HomeBg = styled.div`
  position: fixed;
  width: 100vw;
  height: 100vh;
  background: url(/homeBg.png);
  background-position: center center;
  background-repeat: no-repeat;
  background-size: cover;
  z-index: -1;
`;

const NavBar = styled.nav`
  display: flex;
  align-items: center;
  height: 70px;
  margin-bottom: 50px;
`;
const Navlink = styled.a`
  cursor: pointer;
  font-weight: 600;
  font-size: 18px;
  line-height: 24px;
  letter-spacing: 0.02em;
  color: #b1b1b1;
  padding-bottom: 5px;
  margin: 0 8%;
  border-bottom: 2px solid transparent;
  &:hover {
    border-bottom: 2px solid #3f51b5;
  }
`;
const HomeInnerContainer = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 0 5% 50px 5%;
`;
const IconDiv = styled.div`
  display: flex;
  align-items: center;
  padding-bottom: 60px;
`;
const Icon = styled.img`
  margin: 0 15px;
  cursor: pointer;
`;
const HomeTitle = styled.h1`
  font-family: Japanese;
  font-weight: normal;
  font-size: 64px;
  line-height: 100%;
  letter-spacing: 0.02em;
  color: #ffffff;
  text-transform: uppercase;
  margin: 0px;
  @media screen and (max-width: 1200px) {
    font-size: 52px;
  }
  @media screen and (max-width: 1200px) {
    font-size: 42px;
  }
`;
const HomeTitle2 = styled.h3`
  font-weight: bold;
  font-size: 22px;
  line-height: 130%;
  letter-spacing: 0.02em;
  color: #ffffff;
`;
const Description = styled.p`
  text-align: center;
  max-width: 550px;
`;
const List = styled.li`
  text-align: left;
  color: #fff;
  list-style: none;
  padding-bottom: 25px;
`;
const CounterText = styled.span``;

const MintContainer = styled.div``;

const MintButton = styled(Button)`
  background-color: #3f51b5 !important;
  color: #fff !important;
  margin: 0 15px !important;
  font-weight: 600 !important;
`;

export interface HomeProps {
  candyMachineId: anchor.web3.PublicKey;
  config: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  startDate: number;
  treasury: anchor.web3.PublicKey;
  txTimeout: number;
}

const Home = (props: HomeProps) => {
  const [balance, setBalance] = useState<number>();
  const [isActive, setIsActive] = useState(false); // true when countdown completes
  const [isSoldOut, setIsSoldOut] = useState(false); // true when items remaining is zero
  const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT

  const [itemsAvailable, setItemsAvailable] = useState(0);
  const [itemsRedeemed, setItemsRedeemed] = useState(0);
  const [itemsRemaining, setItemsRemaining] = useState(0);

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });

  const [startDate, setStartDate] = useState(new Date(props.startDate));

  const wallet = useAnchorWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();

  const refreshCandyMachineState = () => {
    (async () => {
      if (!wallet) return;

      const {
        candyMachine,
        goLiveDate,
        itemsAvailable,
        itemsRemaining,
        itemsRedeemed,
      } = await getCandyMachineState(
        wallet as anchor.Wallet,
        props.candyMachineId,
        props.connection
      );

      setItemsAvailable(itemsAvailable);
      setItemsRemaining(itemsRemaining);
      setItemsRedeemed(itemsRedeemed);

      setIsSoldOut(itemsRemaining === 0);
      setStartDate(goLiveDate);
      setCandyMachine(candyMachine);
    })();
  };

  const onMint = async () => {
    try {
      setIsMinting(true);
      if (wallet && candyMachine?.program) {
        const mintTxId = await mintOneToken(
          candyMachine,
          props.config,
          wallet.publicKey,
          props.treasury
        );

        const status = await awaitTransactionSignatureConfirmation(
          mintTxId,
          props.txTimeout,
          props.connection,
          "singleGossip",
          false
        );

        if (!status?.err) {
          setAlertState({
            open: true,
            message: "Congratulations! Mint succeeded!",
            severity: "success",
          });
        } else {
          setAlertState({
            open: true,
            message: "Mint failed! Please try again!",
            severity: "error",
          });
        }
      }
    } catch (error: any) {
      // TODO: blech:
      let message = error.msg || "Minting failed! Please try again!";
      if (!error.msg) {
        if (error.message.indexOf("0x138")) {
        } else if (error.message.indexOf("0x137")) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          setIsSoldOut(true);
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      setAlertState({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
      setIsMinting(false);
      refreshCandyMachineState();
    }
  };

  const mintMore = () => {
    for (var i = 1; i < 2; i++) {
      onMint(); onMint();
    }
  };

  
  const mintMuch = () => {
    for (var i = 1; i < 3; i++) {
      onMint(); onMint(); onMint();
    }
  };

  useEffect(() => {
    (async () => {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
    })();
  }, [wallet, props.connection]);

  useEffect(refreshCandyMachineState, [
    wallet,
    props.candyMachineId,
    props.connection,
  ]);

  return (
    <HomeContainer>
      <HomeBg></HomeBg>
      <NavBar>
        <Grid xs={6} style={{ textAlign: "right" }}>
          <Navlink>Home</Navlink>
        </Grid>
        <Grid xs={6}>
          <Navlink style={{ borderBottom: "2px solid #3f51b5" }}>Mint</Navlink>
        </Grid>
      </NavBar>
      <HomeInnerContainer>
        <IconDiv>
          <Grid xs={6} style={{ textAlign: "right" }}>
            <Icon src="/discordIcon.svg" alt="Discord" />
          </Grid>
          <Grid xs={6}>
            <Icon src="/twitterIcon.svg" alt="Twitter" />
          </Grid>
        </IconDiv>
        <HomeTitle>Eternalz</HomeTitle>
        <br />
        <Description style={{ margin: 0 }}>Presale Batch 1 Live</Description>
        <Description>
          1,888 unique aesthetic collectibles with references from anime, games,
          movies, memes and more. Find one which fits you best in the metaverse.
        </Description>
        <br />
        <Description style={{ margin: 0 }}>Only 400 available</Description>
        <HomeTitle2>Cost: 0.7 SOL {wallet && "for 1"}</HomeTitle2>
        <br />
        <ul>
          {wallet && (
            <List>
              Address: {shortenAddress(wallet.publicKey.toBase58() || "")}
            </List>
          )}
          {wallet && (
            <List>Balance: {(balance || 0).toLocaleString()} SOL</List>
          )}

          {wallet && <List>Total Available: 400</List>}

          {wallet && <List>Redeemed: {itemsRedeemed}</List>}
        </ul>
        <MintContainer>
          {!wallet ? (
            <ConnectButton style={{ fontWeight: 600 }}>
              Connect Wallet
            </ConnectButton>
          ) : (
            <div>
              <MintButton
                disabled={isSoldOut || isMinting || !isActive}
                onClick={onMint}
                variant="contained"
              >
                {isSoldOut ? (
                  "SOLD OUT"
                ) : isActive ? (
                  isMinting ? (
                    <CircularProgress />
                  ) : (
                    "MINT 1 NFT"
                  )
                ) : (
                  <Countdown
                    date={startDate}
                    onMount={({ completed }) => completed && setIsActive(true)}
                    onComplete={() => setIsActive(true)}
                    renderer={renderCounter}
                  />
                )}
              </MintButton>
              <MintButton
                disabled={isSoldOut || isMinting || !isActive}
                onClick={mintMore}
                variant="contained"
              >
                {isSoldOut ? (
                  "SOLD OUT"
                ) : isActive ? (
                  isMinting ? (
                    <CircularProgress />
                  ) : (
                    "MINT 2 NFTs"
                  )
                ) : (
                  <Countdown
                    date={startDate}
                    onMount={({ completed }) => completed && setIsActive(true)}
                    onComplete={() => setIsActive(true)}
                    renderer={renderCounter}
                  />
                )}
              </MintButton>
            </div>
          )}
        </MintContainer>

        <Snackbar
          open={alertState.open}
          autoHideDuration={6000}
          onClose={() => setAlertState({ ...alertState, open: false })}
        >
          <Alert
            onClose={() => setAlertState({ ...alertState, open: false })}
            severity={alertState.severity}
          >
            {alertState.message}
          </Alert>
        </Snackbar>
      </HomeInnerContainer>
    </HomeContainer>
  );
};

interface AlertState {
  open: boolean;
  message: string;
  severity: "success" | "info" | "warning" | "error" | undefined;
}

const renderCounter = ({ days, hours, minutes, seconds, completed }: any) => {
  return (
    <CounterText>
      {hours + (days || 0) * 24} hours, {minutes} minutes, {seconds} seconds
    </CounterText>
  );
};

export default Home;
