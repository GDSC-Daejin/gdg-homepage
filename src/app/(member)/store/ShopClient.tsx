"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { purchaseMonsterBalls } from "@/actions/monster-ball-shop";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { MONSTER_BALL_DAILY_LIMIT, MONSTER_BALL_PRODUCTS } from "@/lib/monster-ball-shop";

export function ShopClient({ dailyPurchased }: { dailyPurchased: number }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function buy(quantity: number) {
    const formData = new FormData();
    formData.set("quantity", String(quantity));
    formData.set("request_id", crypto.randomUUID());
    setError(undefined);
    startTransition(async () => {
      const result = await purchaseMonsterBalls(formData);
      if (result.error) setError(result.error);
      else window.location.reload();
    });
  }

  return <>
    {error && <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
    <div className="mb-6 rounded-xl bg-primary-soft px-5 py-4 text-sm text-gray-700">
      오늘 구매한 몬스터볼 <strong className="text-primary">{dailyPurchased}/{MONSTER_BALL_DAILY_LIMIT}개</strong>
    </div>
    <div className="grid gap-4 sm:grid-cols-3">
      {MONSTER_BALL_PRODUCTS.map((product) => {
        const disabled = pending || dailyPurchased + product.quantity > MONSTER_BALL_DAILY_LIMIT;
        return <Card key={product.quantity} className="flex flex-col justify-between p-5">
          <div><Image src="/pokedex/effects/monster-ball-shop.png" alt="몬스터볼" width={64} height={64} className="h-16 w-16 object-contain" /><h2 className="mt-3 font-semibold text-gray-900">몬스터볼 {product.quantity}개</h2><p className="mt-1 text-sm text-gray-500">{product.price.toLocaleString()}P</p></div>
          <Button type="button" variant="primary" className="mt-5 w-full" disabled={disabled} onClick={() => buy(product.quantity)}>{disabled && dailyPurchased + product.quantity > MONSTER_BALL_DAILY_LIMIT ? "오늘 한도 초과" : pending ? "교환 중..." : "교환하기"}</Button>
        </Card>;
      })}
    </div>
  </>;
}
