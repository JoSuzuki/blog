---
date: 2021-06-05
author: Jonathan Suzuki
title: Muito (im)provável
description: Que nós somos péssimos em estimar probabilidades não é uma novidade...
tags:
  - dia a dia
---

# Muito ~~im~~provável

Que nós somos péssimos em estimar probabilidades não é uma novidade, mas tem vezes que essa incompreensão me pega de surpresa. Esses dias estava conversando com uns amigos que um lootbox (tipo uma loteria) de skins (roupas pra personagens) era manipulado em favor de 1. dar as mesmas skins pra um mesmo grupo de pessoas e 2. dar skins de personagens populares. O segundo ponto tinha um certo consenso de que provavelmente era viés nosso, uma vez que personagens populares têm mais skins. De qualquer forma estávamos devagando que num universo de 1251 skins e a gnt com um grupo de 6 pessoas recebíamos muitas skins repetidas num intervalo de tempo curto.

Eu lembrei do [paradoxo do aniversário](https://pt.wikipedia.org/wiki/Paradoxo_do_anivers%C3%A1rio) um problema que me deixou muito bolado a primeira vez que ouvi: numa sala com mais de 23 pessoas a probabilidade de que se tenham duas pessoas que façam aniversário no mesmo dia é de mais de 50%, mesmo com 365 dias! Essa probabilidade é tipo tirar cara num flipe de uma moeda. Na wikipédia ele mostra a fórmula para calcular a probabilidade desse evento acontecer e felizmente tinha um snippet javascript, então a gnt deciciu ver qual era a probabilidade da gnt encontrar a mesma skin num dado mês. Chegamos a conclusão que a gnt conseguia abrir (e re-rolar) 8 skins por pessoa por mês, então 48 skins por mês, pegamos esse número e jogamos na fórmula (se vc quiser pode fazer tbm):

1. Abra o devtools apertando `F12`
2. Clique na tab que diz `console`
3. Copie e cole a função abaixo
4. Chame a funçao com `chanceOfSeeingTheSameSkin(48)`

```js
function chanceOfSeeingTheSameSkin(numberOfSkinsSeen) {
  let p = (1.0 / 1251) ** numberOfSkinsSeen
  for (let i = 1252 - numberOfSkinsSeen; i < 1252; i++) {
    p *= i
  }
  return 1 - p
}
```

> 0.5988069260942293

59,8% de chance de ver a mesma skin em 48 skins por mês, maior do que a probabilide de tirar cara num flip de uma moeda. E foi ai que a gnt percebeu que o ~~im~~provável, era na verdade, muito provável.
