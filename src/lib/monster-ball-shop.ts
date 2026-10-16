// 프렌들리숍 상품 구성. 화면과 서버 액션이 같이 쓰고, purchase_monster_balls RPC의 수량·가격과 같아야 한다.
export const MONSTER_BALL_PRODUCTS = [
  { quantity: 1, price: 25 },
  { quantity: 3, price: 70 },
  { quantity: 5, price: 110 },
] as const;

export const MONSTER_BALL_DAILY_LIMIT = 5;

export function isMonsterBallQuantity(quantity: number): boolean {
  return MONSTER_BALL_PRODUCTS.some((product) => product.quantity === quantity);
}
