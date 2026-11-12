export const COMPLETION_POINTS = 1;
export const rewardProducts = [
  {
    id: "stickers",
    name: "小龙虾贴纸",
    english: "Oopsie Stickers",
    cost: 20,
    image: "/assets/stickers.jpg",
  },
  {
    id: "phone-grip",
    name: "小龙虾手机支架",
    english: "Phone Grip",
    cost: 80,
    image: "/assets/phone-grip.png",
  },
  {
    id: "doormat",
    name: "欢迎回家地毯",
    english: "Welcome Home Mat",
    cost: 130,
    image: "/assets/welcome.jpg",
  },
] as const;
export type Redemption = {
  id: string;
  productId: string;
  name: string;
  cost: number;
  at: string;
  status: "reserved";
};
export type Wallet = {
  balance: number;
  earned: number;
  completedCount: number;
  redemptions: Redemption[];
};
export const emptyWallet = (): Wallet => ({
  balance: 0,
  earned: 0,
  completedCount: 0,
  redemptions: [],
});
