import { studionet } from "genlayer-js/chains";

export const chain = studionet;
export const defaultContract = () => process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
export const explorer = (hash: string) => `${process.env.NEXT_PUBLIC_EXPLORER_TX_BASE || "https://explorer-studio.genlayer.com/tx/"}${hash}`;
