import React, { useState, useEffect, useMemo } from "react";
import { useWeb3 } from "../context/Web3Context";
import { ethers } from "ethers";
import { WEB3_CONFIG, STONKBROKER_BUY_URL, IPFS_GATEWAY } from "../config/web3";
import { WEB3_CONFIG, Minibrokers_BUY_URL, IPFS_GATEWAY } from "../config/web3";

// Turns "ipfs://CID/1.json" or "ipfs://CID/1" into a fetchable https gateway URL.
function toGatewayUrl(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    const path = uri.replace("ipfs://", "");
    const gateway = IPFS_GATEWAY.endsWith("/") ? IPFS_GATEWAY : IPFS_GATEWAY + "/";
    return gateway + path;
  }
  return uri;
}

const PREVIEW_COUNT = 8;
const ROTATE_MS = 2200;

/** Cycles through IPFS metadata images, one at a time, with a crossfade. */
const IpfsPreviewCarousel: React.FC<{ baseUri: string; revealed: boolean; maxSupply: bigint }> = ({
  baseUri,
  revealed,
  maxSupply,
}) => {
  const [images, setImages] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  const tokenIds = useMemo(() => {
    const cap = Number(maxSupply) || 10000;
    // A spread of token ids across the collection, not just #1..#8.
    const step = Math.max(1, Math.floor(cap / PREVIEW_COUNT));
    return Array.from({ length: PREVIEW_COUNT }, (_, i) => (i * step) + 1);
  }, [maxSupply]);

  useEffect(() => {
    let cancelled = false;

    async function loadImages() {
      if (!baseUri) return;

      // Pre-reveal: baseUri IS the single placeholder metadata URI — same image every time.
      if (!revealed) {
        try {
          const res = await fetch(toGatewayUrl(baseUri));
          const meta = await res.json();
          if (!cancelled && (meta.image || meta.image_url)) {
            setImages([toGatewayUrl(meta.image || meta.image_url)]);
          }
        } catch {
          /* keep placeholder fallback */
        }
        return;
      }

      // Post-reveal: baseUri + tokenId (no extension) per the contract's tokenURI().
      let formattedBase = baseUri.trim();
      if (!formattedBase.endsWith("/")) {
        formattedBase += "/";
      }

      const results: string[] = [];
      for (const id of tokenIds) {
        try {
          const res = await fetch(toGatewayUrl(formattedBase + id));
          const meta = await res.json();
          const img = meta.image || meta.image_url;
          if (img) {
            results.push(toGatewayUrl(img));
          }
        } catch {
          /* skip a missing/unavailable id */
        }
      }
      if (!cancelled && results.length) setImages(results);
    }

    loadImages();
    return () => {
      cancelled = true;
    };
  }, [baseUri, revealed, tokenIds]);

  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [images]);

  if (!images.length) {
    return (
      <div className="text-center p-6 z-20">
        <span className="text-4xl text-zinc-700 font-extrabold group-hover:text-[#CCFF00] transition-colors">
          MB NFT
        </span>
        <p className="text-[10px] text-zinc-500 tracking-widest mt-2">PREVIEW TERMINAL</p>
      </div>
    );
  }

  return (
    <>
      {images.map((src, i) => (
        <img
          key={src + i}
          src={src}
          alt="NFT preview"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </>
  );
};

export const MintCard: React.FC = () => {
  const {
    account,
    totalSupply,
    maxSupply,
    mintPrice,
    isPaused,
    publicMintEnabled,
    revealed,
    baseUri,
    tokenSymbol,
    tokenDecimals,
    txState,
    txHash,
    errorMessage,
    mintNft,
    connectWallet,
    isCorrectNetwork,
    switchNetwork,
    walletConnectReady,
  } = useWeb3();

  const [quantity, setQuantity] = useState<number>(1);

  const formattedPrice = ethers.formatUnits(mintPrice, tokenDecimals);
  const totalPrice = (Number(formattedPrice) * quantity).toFixed(4);
  const remainingSupply = Number(maxSupply) - Number(totalSupply);
  const mintLive = publicMintEnabled && !isPaused;

  const increment = () => setQuantity((prev) => Math.min(prev + 1, 20));
  const decrement = () => setQuantity((prev) => Math.max(prev - 1, 1));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Artwork Preview Terminal Box */}
      <div className="lg:col-span-5 border border-zinc-800 bg-[#0f1115] p-4 flex flex-col space-y-4">
        <div className="relative aspect-square w-full bg-zinc-950 border border-zinc-800/80 flex items-center justify-center group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 pointer-events-none" />
          <IpfsPreviewCarousel baseUri={baseUri} revealed={revealed} maxSupply={maxSupply} />
        </div>

        <div className="flex justify-between items-center text-[10px] text-zinc-500 px-1">
          <span>STANDARD ERC-721A</span>
          <span>{revealed ? "REVEALED" : "LIVE METADATA · IPFS"}</span>
        </div>

        {/* Buy $StonkBroker */}
        <a
          href={STONKBROKER_BUY_URL}
          target="_blank"
          rel="noreferrer"
          className="w-full py-2.5 text-center bg-zinc-900 border border-[#CCFF00]/40 text-[#CCFF00] font-bold text-xs tracking-widest hover:bg-[#CCFF00]/10 transition-colors"
        >
          BUY $StonkBroker ↗
        </a>
      </div>

      {/* Mint Control Terminal */}
      <div className="lg:col-span-7 border border-zinc-800 bg-[#0f1115] p-6 space-y-6">
        <div>
          <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold text-white tracking-wider">MINI BROKERS</h2>
            <span
              className={`px-2.5 py-1 text-[10px] font-bold tracking-widest border ${
                !mintLive
                  ? "bg-amber-950/30 text-amber-400 border-amber-800"
                  : "bg-emerald-950/30 text-[#CCFF00] border-[#CCFF00]/40"
              }`}
            >
              ● {mintLive ? "LIVE" : "PAUSED"}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            Exclusive collector tokens for the Mini Brokers digital ecosystem. Connect wallet to request mint execution directly on-chain.
          </p>
        </div>

        {/* Dynamic Metric Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-zinc-950 border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 block">TOTAL SUPPLY</span>
            <span className="text-sm font-bold text-white">{maxSupply.toString()}</span>
          </div>
          <div className="p-3 bg-zinc-950 border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 block">MINTED</span>
            <span className="text-sm font-bold text-white">{totalSupply.toString()}</span>
          </div>
          <div className="p-3 bg-zinc-950 border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 block">REMAINING</span>
            <span className="text-sm font-bold text-white">{remainingSupply}</span>
          </div>
          <div className="p-3 bg-zinc-950 border border-zinc-800/60">
            <span className="text-[10px] text-zinc-500 block">MINT PRICE</span>
            <span className="text-sm font-bold text-[#CCFF00]">
              {formattedPrice} {tokenSymbol}
            </span>
          </div>
        </div>

        {/* Quantity Selector */}
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <label className="text-[10px] text-zinc-400 uppercase tracking-widest">Select Mint Quantity</label>
          <div className="flex items-center space-x-4">
            <div className="flex border border-zinc-800 bg-zinc-950">
              <button
                onClick={decrement}
                className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-900 border-r border-zinc-800 font-bold"
              >
                −
              </button>
              <span className="px-6 py-2 text-white font-bold text-center min-w-[60px]">{quantity}</span>
              <button
                onClick={increment}
                className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-900 border-l border-zinc-800 font-bold"
              >
                +
              </button>
            </div>

            <div className="flex-1 p-2 bg-zinc-950 border border-zinc-800/60 text-right">
              <span className="text-[10px] text-zinc-500 block">TOTAL REQUIRED</span>
              <span className="text-sm font-bold text-[#CCFF00]">
                {totalPrice} {tokenSymbol}
              </span>
            </div>
          </div>
        </div>

        {/* Transaction Action Panel */}
        <div className="space-y-3 pt-2">
          {!walletConnectReady ? (
            <div className="p-3 border border-amber-900/50 bg-amber-950/20 text-amber-400 text-xs">
              WalletConnect Project ID not configured yet — set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.
            </div>
          ) : !account ? (
            <button
              onClick={connectWallet}
              className="w-full py-3.5 bg-[#CCFF00] text-black font-bold tracking-widest text-xs hover:bg-[#b8e600] transition-colors"
            >
              CONNECT WALLET TO MINT
            </button>
          ) : !isCorrectNetwork ? (
            <button
              onClick={switchNetwork}
              className="w-full py-3.5 bg-red-600 text-white font-bold tracking-widest text-xs hover:bg-red-700"
            >
              SWITCH TO REQUIRED NETWORK
            </button>
          ) : (
            <button
              onClick={() => mintNft(quantity)}
              disabled={!mintLive || txState === "TRANSACTION_PENDING" || txState === "CONFIRM_IN_WALLET" || txState === "AWAITING_SIGNATURE"}
              className="w-full py-3.5 bg-[#CCFF00] text-black font-bold tracking-widest text-xs hover:bg-[#b8e600] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-[0_0_15px_rgba(204,255,0,0.15)]"
            >
              {txState === "AWAITING_SIGNATURE" && "SIGN IN WALLET..."}
              {txState === "CONFIRM_IN_WALLET" && "CONFIRM IN WALLET..."}
              {txState === "TRANSACTION_PENDING" && "TRANSACTION PROCESSING..."}
              {!["AWAITING_SIGNATURE", "CONFIRM_IN_WALLET", "TRANSACTION_PENDING"].includes(txState) &&
                (mintLive ? "MINT NFT" : "MINT NOT LIVE")}
            </button>
          )}

          {/* Transaction Status Box */}
          {txState !== "IDLE" && (
            <div className="p-3 border border-zinc-800 bg-zinc-950 space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-500">STATUS</span>
                <span
                  className={`font-bold ${
                    txState === "MINT_SUCCESSFUL"
                      ? "text-[#CCFF00]"
                      : txState === "TRANSACTION_FAILED" || txState === "TRANSACTION_REJECTED"
                      ? "text-red-400"
                      : "text-amber-400"
                  }`}
                >
                  {txState.replace(/_/g, " ")}
                </span>
              </div>

              {txHash && (
                <div className="text-[10px] pt-1 border-t border-zinc-900 flex justify-between">
                  <span className="text-zinc-500">TX HASH:</span>
                  <a
                    href={`${WEB3_CONFIG.EXPLORER_URL}/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#CCFF00] hover:underline"
                  >
                    {txHash.slice(0, 10)}...{txHash.slice(-8)} ↗
                  </a>
                </div>
              )}

              {errorMessage && (
                <p className="text-[10px] text-red-400 pt-1 border-t border-zinc-900">{errorMessage}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
