# 🔮 The StickerDex Prediction Model — Full Methodology

This document explains, from first principles, exactly how StickerDex forecasts the FIFA World
Cup 2026: how it rates teams, how it turns a rating into a match result, and how it simulates the
whole tournament to produce each team's probability of lifting the trophy.

It is written to be **beginner-friendly** — every idea is motivated in plain English before any
formula — while still giving **all the details and the exact parameters** used in the code, with
**academic citations** so you can check the methods against the literature.

> **TL;DR.** Strength is measured with **Elo ratings**. A match is turned into a scoreline with an
> **independent Poisson goal model** parameterised by the Elo gap. The full bracket is then played
> out tens of thousands of times by **Monte Carlo simulation**, and the fraction of simulations a
> team wins is its title probability. Matches you've already entered are treated as fixed, so the
> forecast updates live.

**Where it lives in the code:**
[`backend/src/services/predictions.ts`](../backend/src/services/predictions.ts) (ratings + single-match probabilities)
and [`backend/src/services/simulator.ts`](../backend/src/services/simulator.ts) (the Monte Carlo engine).

---

## Table of contents

1. [The big picture](#1-the-big-picture)
2. [Step 1 — Team strength: Elo ratings](#2-step-1--team-strength-elo-ratings)
3. [Step 2 — From strength to a single match](#3-step-2--from-strength-to-a-single-match)
4. [Step 3 — Simulating one tournament](#4-step-3--simulating-one-tournament)
5. [Step 4 — From many simulations to probabilities](#5-step-4--from-many-simulations-to-probabilities)
6. [Conditioning on real results (a *live* forecast)](#6-conditioning-on-real-results-a-live-forecast)
7. [Assumptions, limitations & honesty](#7-assumptions-limitations--honesty)
8. [How this compares to published forecasters](#8-how-this-compares-to-published-forecasters)
9. [Parameter reference](#9-parameter-reference)
10. [References](#10-references)

---

## 1. The big picture

Essentially every serious World Cup forecaster — from academic papers to FiveThirtyEight — follows
the same three-step recipe [[Groll 2019]](#groll2019) [[Zeileis 2018]](#zeileis2018)
[[FiveThirtyEight]](#spi):

1. **Rate the teams.** Give every team a single number describing how strong it is.
2. **Model one match.** Convert two teams' ratings into probabilities of outcomes (or a scoreline).
3. **Simulate the tournament.** Play the entire competition thousands of times at random, following
   the model, and count how often each team advances or wins.

The German forecaster **Joachim Klement** — who correctly called the 2014, 2018 and 2022 champions
and picks the **Netherlands** for 2026 — uses exactly this structure, with strength built from FIFA
ranking, GDP, population and "football culture" plus a dose of randomness, then **simulated**
[[ESPN 2026]](#klement) [[beIN 2026]](#klementbein). StickerDex uses the same skeleton, but with a
transparent, self-contained strength measure — **Elo** — that updates itself from the results you
enter. Nothing is a black box; every step below is something you can compute by hand.

---

## 2. Step 1 — Team strength: Elo ratings

### 2.1 The intuition

Elo, invented for chess by physicist **Árpád Élő** [[Elo 1978]](#elo1978), gives each team a single
number (around 1500–2000). The only thing that matters is the **difference** between two teams'
numbers: a larger gap means the favourite is more likely to win. After each game the winner takes
points from the loser — beat a much stronger team and you gain a lot; lose to a minnow and you drop
a lot. Over time the numbers settle at values that reflect real strength. A football-adapted Elo
("World Football Elo") is a well-established international-team rating
[[World Football Elo]](#wfelo) and is competitive with more complex models
[[Ley 2019]](#ley2019).

### 2.2 The expected score

If team $A$ has rating $R_A$ and team $B$ has rating $R_B$, Elo's **expected score** for $A$
(a number between 0 and 1, think "expected share of the points") is

$$
E_A = \frac{1}{1 + 10^{\,(R_B - R_A)/400}}, \qquad E_B = 1 - E_A .
$$

The constant **400** sets the scale: a **400-point** lead makes you ten times more likely to score
the "win". Equal ratings give $E_A = 0.5$. This is the logistic function and is the single most
important formula in the model. In code it is `expectedScore(a, b)`.

### 2.3 Home advantage

Playing at home is worth roughly **+60 Elo points**, added to the home side before computing the
expected score [[World Football Elo]](#wfelo). Because the 2026 hosts (USA, Canada, Mexico) play
"at home" only in the group stage and venues are shared thereafter, StickerDex applies a
**neutral-venue weight** $w$ to this bonus:

$$
\Delta = \big(R_{\text{home}} + H\cdot w\big) - R_{\text{away}}, \qquad H = 60 .
$$

- Group stage: $w = 1$ (full home advantage).
- Knockout: mostly neutral sites, so $w \approx 0.35$ in the tournament simulator and $w = 0.4$ in
  the single-match win/draw/win predictions (the two were tuned independently).

### 2.4 Updating ratings from results (learning)

Ratings are not frozen. Every match that has actually been **played** nudges the two teams' ratings
toward reality, using Elo's update rule:

$$
R'_A = R_A + K \cdot G \cdot (S_A - E_A) .
$$

- $S_A$ is the **actual** result for $A$: win = 1, draw = 0.5, loss = 0.
- $E_A$ is the expected score from §2.2 (including home advantage).
- $K = 40$ is the **learning rate** — World-Cup matches are important, so $K$ is large (FIFA's own
  rating uses larger $K$ for major finals [[FIFA SUM]](#fifasum)).
- $G$ is a **goal-difference multiplier** so that thrashings move ratings more than narrow wins,
  using the standard World Football Elo index [[World Football Elo]](#wfelo):

$$
G = \begin{cases}
1, & \text{margin} \le 1 \\
1.5, & \text{margin} = 2 \\
\dfrac{11 + \text{margin}}{8}, & \text{margin} \ge 3 .
\end{cases}
$$

StickerDex starts every team from an approximate **seed rating** (a coarse strength tier — an
*estimate*, not an official ranking) and then **replays every entered result in chronological
order**, applying the update above, so the ratings you simulate from already reflect what has
actually happened. This is `buildRatings()` in the code.

> **Why seeds at all?** With zero prior information every team would start equal and early
> predictions would be uninformative. The seeds encode "Argentina ≫ Curaçao" on day one; results
> then take over. The seeds are the model's main *subjective* input — see
> [Limitations](#7-assumptions-limitations--honesty).

---

## 3. Step 2 — From strength to a single match

There are two related models. The first gives the **win/draw/win bar** you see on the Schedule; the
second produces **scorelines** and is what the tournament simulator uses.

### 3.1 Win / draw / win probabilities

Let $e = E_{\text{home}}$ be the home team's Elo expected score (with home advantage, §2.3). We split
the outcome into win/draw/loss. Draws are most likely when the teams are evenly matched and vanish
when one side dominates, so we model the draw probability as

$$
p_{\text{draw}} = d_{\max}\,\big(1 - 2\,|e - 0.5|\big), \qquad d_{\max} = 0.28,
$$

and distribute the rest in proportion to the expected score:

$$
p_{\text{home}} = e\,(1 - p_{\text{draw}}), \qquad
p_{\text{away}} = (1-e)\,(1 - p_{\text{draw}}).
$$

These three always sum to 1. The peak draw rate $d_{\max}=0.28$ matches the empirical share of draws
in international football. This is `predict()` in the code.

### 3.2 The Poisson goal model (used for simulation)

To simulate a tournament we need **scorelines**, not just who wins — group ranking depends on goal
difference and goals scored. The standard tool, dating to **Maher (1982)**
[[Maher 1982]](#maher1982) and refined by **Dixon & Coles (1997)** [[Dixon-Coles 1997]](#dixoncoles),
is the **Poisson distribution**: the number of goals a team scores in a match is well-described by a
Poisson random variable.

A Poisson distribution with mean $\lambda$ gives the probability of scoring exactly $k$ goals as

$$
P(k) = \frac{e^{-\lambda}\,\lambda^{k}}{k!}, \qquad k = 0,1,2,\dots
$$

Its mean *and* variance both equal $\lambda$, so we only need each team's **expected goals** $\lambda$.

We derive the two expected-goal values from the Elo gap. Define the rating difference $\Delta$ as in
§2.3 and a **supremacy** (expected goal difference):

$$
s = \frac{\Delta}{100}\times \sigma, \qquad \sigma = 0.36 \ \text{goals per 100 Elo}.
$$

Then split a fixed expected **total** of goals $\mu = 2.75$ (about the historical average for a World
Cup match) into the two sides:

$$
\lambda_{\text{home}} = \max\!\Big(0.2,\ \tfrac{\mu}{2} + \tfrac{s}{2}\Big), \qquad
\lambda_{\text{away}} = \max\!\Big(0.2,\ \tfrac{\mu}{2} - \tfrac{s}{2}\Big).
$$

This has two nice properties: the **expected total** is always $\mu$
($\lambda_{\text{home}}+\lambda_{\text{away}}=\mu$), while the **expected difference** is the
supremacy $s$ ($\lambda_{\text{home}}-\lambda_{\text{away}}=s$). The floor of $0.2$ keeps even huge
underdogs with a puncher's chance. This is `sampleScore()` in the code.

To play a match we draw two independent Poisson samples:

$$
\text{goals}_{\text{home}} \sim \text{Poisson}(\lambda_{\text{home}}), \qquad
\text{goals}_{\text{away}} \sim \text{Poisson}(\lambda_{\text{away}}).
$$

Sampling uses **Knuth's algorithm** [[Knuth 1997]](#knuth): multiply uniform random numbers until
the product drops below $e^{-\lambda}$; the count of multiplications minus one is the sample.

> **Simplification.** We treat the two scores as **independent**. Real scores are slightly
> correlated (low-scoring draws are a touch more common than independence predicts), which the
> **Dixon–Coles** [[Dixon-Coles 1997]](#dixoncoles) and **bivariate Poisson**
> [[Karlis-Ntzoufras 2003]](#karlis) models correct for. We omit that correction for clarity; its
> effect on tournament-level probabilities is small.

---

## 4. Step 3 — Simulating one tournament

"Simulating" means: play every match by drawing random scorelines from the model above, follow the
real competition rules, and see who wins. One simulation = one possible version of the World Cup.

### 4.1 Group stage

For each of the 12 groups, all 6 matches are played (sampled, or taken from real results if already
entered — see §6). Teams are ranked by the usual rules: **points** (3/1/0), then **goal
difference**, then **goals for**, with ties broken at random as a stand-in for FIFA's finer
tiebreakers (head-to-head record, fair-play points, then drawing of lots
[[FIFA 2026]](#fifa2026)). The top **two** of each group advance, plus the **eight best
third-placed teams**.

### 4.2 The eight best third-placed teams

With 12 groups, eight of the twelve third-placed teams qualify. FIFA's bracket has eight specific
Round-of-32 slots, each of which may only be filled by a third-placed team **from a fixed set of
groups** (e.g. one slot accepts "3rd of A/B/C/D/F"). Matching the eight qualifying thirds to these
eight constrained slots is an **assignment problem** [[Kuhn 1955]](#kuhn). StickerDex reads the
allowed groups straight from the official bracket labels and solves it with a small backtracking
**bipartite matching**, so every slot gets a distinct, eligible team. (Any valid matching is used;
the exact slot a third lands in barely affects title odds.)

### 4.3 Knockout rounds

From the Round of 32 onward, each tie is a single match. We draw a scoreline with the neutral-venue
weight ($w = 0.35$). If it is **drawn**, the match goes to a **penalty shootout**, modelled as a
Bernoulli (biased coin) using the no-home-advantage Elo expected score:

$$
P(\text{home wins shootout}) = \frac{1}{1 + 10^{\,(R_{\text{away}} - R_{\text{home}})/400}} .
$$

This reflects evidence that shootouts are close to a coin flip with only small skill effects
[[Apesteguia-PH 2010]](#apesteguia). Winners propagate through the bracket exactly as in the real
draw (the `W74`, `L101`, … references in the schedule data), all the way to the final. The final's
winner is that simulation's **champion**.

---

## 5. Step 4 — From many simulations to probabilities

One simulation is just one story. Run it **N times** (default $N = 10{,}000$; up to $50{,}000$) and
count outcomes. A team's probability of, say, winning the cup is simply the **fraction of
simulations** in which it does:

$$
\hat{p}_{\text{champion}} = \frac{\#\{\text{runs the team won}\}}{N}.
$$

This is **Monte Carlo estimation** [[Metropolis-Ulam 1949]](#metropolis): by the law of large
numbers, as $N$ grows these fractions converge to the true model probabilities. The same counting
gives each team's chance to win its group, to advance, and to reach each knockout round (these are
**monotone** — reaching the final implies reaching the semis — a property the test-suite checks).

**How many runs are enough?** Each title is a yes/no event, so an estimate $\hat p$ from $N$ runs has
**standard error**

$$
\text{SE}(\hat p) = \sqrt{\frac{\hat p\,(1-\hat p)}{N}} .
$$

For a 12 % favourite at $N = 10{,}000$, $\text{SE} \approx \sqrt{0.12\cdot0.88/10000} \approx
0.33\%$ — i.e. the odds are accurate to a few tenths of a percent, which is plenty for a forecast.
Bump the run count to $50{,}000$ to halve the noise (it scales as $1/\sqrt{N}$). Even $50{,}000$ full
tournaments finish in about a second, entirely on your own machine.

---

## 6. Conditioning on real results (a *live* forecast)

The forecast is **conditional on reality**. Any match you have entered a score for is **not
re-simulated** — its real result is used directly, in both the group stage and (when the bracket
matchup matches reality) the knockouts. Two things follow:

- Played results **move the Elo ratings** (§2.4), changing the strength of every team going forward.
- Played results **fix parts of the bracket**, so the simulation only randomises what hasn't
  happened yet.

The result is the same behaviour as professional in-tournament trackers: before kick-off the model
shows pre-tournament odds; as group games come in, the survivors' probabilities sharpen, and once
the knockouts begin the title race narrows to the remaining teams.

---

## 7. Assumptions, limitations & honesty

This is a transparent statistical model, **not** a crystal ball — and not a machine-learning model
trained on a historical match database (those exist and are excellent, e.g.
[[Groll 2019]](#groll2019)). Known simplifications:

- **Seed ratings are subjective.** The starting strengths are coarse tiers, not an official ranking
  or a market-calibrated number. They are the biggest single assumption; results correct them over
  time but early-tournament odds inherit their bias.
- **No player-level information.** Injuries, suspensions, squad quality, form, travel and fatigue are
  not modelled — only team-level Elo.
- **Independent Poisson goals.** Slight score correlation is ignored (§3.2).
- **Extra time is folded into penalties.** A drawn knockout sample goes straight to a shootout; we do
  not simulate a separate extra-time period.
- **Simplified group tiebreakers.** Points → GD → GF → random, rather than FIFA's full
  head-to-head/fair-play/lots procedure [[FIFA 2026]](#fifa2026).
- **Home advantage is a flat constant**, not venue- or distance-specific.

None of these is hidden: each corresponds to a named constant or function you can read and tweak in
the source. As the forecaster Klement himself cautions, predictions like these are for fun — *"if
anyone places a bet based on my prediction … they're beyond help."* [[ESPN 2026]](#klement)

---

## 8. How this compares to published forecasters

| Forecaster | Strength rating | Match model | Tournament |
| ---------- | --------------- | ----------- | ---------- |
| **StickerDex** | Elo (self-updating) | Independent Poisson | Monte Carlo |
| Dixon–Coles [[1997]](#dixoncoles) | Attack/defence params | Bivariate-ish Poisson + correction | — (match level) |
| Ley et al. [[2019]](#ley2019) | Weighted-ML bivariate Poisson | Bivariate Poisson | Monte Carlo |
| Groll et al. [[2019]](#groll2019) | Random forest on many features | Poisson via RF | Monte Carlo |
| Zeileis et al. [[2018]](#zeileis2018) | Bookmaker-consensus odds | Implied abilities | Monte Carlo |
| FiveThirtyEight [[SPI]](#spi) | SPI (offence/defence) | Poisson | Monte Carlo |

The **engine** (rating → Poisson → Monte Carlo) is exactly the academic mainstream; StickerDex's
deliberate choice is to keep the **strength input** simple, explainable and self-hosted rather than
to fit a model on an external dataset or pull live bookmaker odds.

---

## 9. Parameter reference

Every tunable constant, its value, meaning, and where to find it.

| Symbol | Code constant | Value | Meaning |
| ------ | ------------- | ----- | ------- |
| scale | — | `400` | Elo points for a 10× odds swing |
| $H$ | `HOME_ADVANTAGE` | `60` | Home-advantage bonus (Elo points) |
| $w$ | neutral weight | `1` group / `0.35`–`0.4` knockout | Fraction of $H$ applied |
| $K$ | `K` | `40` | Elo learning rate (high — major tournament) |
| $G$ | `marginMultiplier` | `1 / 1.5 / (11+n)/8` | Goal-difference weight on updates |
| — | `SEED` | per-team | Approximate starting ratings (subjective) |
| — | `DEFAULT_RATING` | `1600` | Rating for any team without a seed |
| $d_{\max}$ | `drawPeak` | `0.28` | Peak draw probability (even match) |
| $\mu$ | `GOAL_BASE` | `2.75` | Expected total goals per match |
| $\sigma$ | `SUPREMACY_PER_100` | `0.36` | Goal-diff per 100 Elo of edge |
| floor | — | `0.2` | Minimum expected goals for any side |
| $N$ | `runs` | `10,000` (max `50,000`) | Monte Carlo simulations |

Sources: [`predictions.ts`](../backend/src/services/predictions.ts),
[`simulator.ts`](../backend/src/services/simulator.ts). Edit a constant, restart, and the forecast
changes accordingly — it's all explainable.

---

## 10. References

<a id="elo1978"></a>**[Elo 1978]** Élő, Á. (1978). *The Rating of Chessplayers, Past and Present.* Arco Publishing.

<a id="wfelo"></a>**[World Football Elo]** *World Football Elo Ratings — Methodology.* eloratings.net. <https://www.eloratings.net/about>

<a id="maher1982"></a>**[Maher 1982]** Maher, M. J. (1982). "Modelling association football scores." *Statistica Neerlandica*, 36(3), 109–118.

<a id="dixoncoles"></a>**[Dixon-Coles 1997]** Dixon, M. J., & Coles, S. G. (1997). "Modelling Association Football Scores and Inefficiencies in the Football Betting Market." *Journal of the Royal Statistical Society: Series C (Applied Statistics)*, 46(2), 265–280.

<a id="karlis"></a>**[Karlis-Ntzoufras 2003]** Karlis, D., & Ntzoufras, I. (2003). "Analysis of sports data by using bivariate Poisson models." *Journal of the Royal Statistical Society: Series D (The Statistician)*, 52(3), 381–393.

<a id="ley2019"></a>**[Ley 2019]** Ley, C., Van de Wiele, T., & Van Eetvelde, H. (2019). "Ranking soccer teams on the basis of their current strength: A comparison of maximum likelihood approaches." *Statistical Modelling*, 19(1), 55–73.

<a id="groll2019"></a>**[Groll 2019]** Groll, A., Ley, C., Schauberger, G., & Van Eetvelde, H. (2019). "A hybrid random forest to predict soccer matches in international tournaments." *Journal of Quantitative Analysis in Sports*, 15(4), 271–287.

<a id="zeileis2018"></a>**[Zeileis 2018]** Zeileis, A., Leitner, C., & Hornik, K. (2018). "Probabilistic Forecasts for the 2018 FIFA World Cup Based on the Bookmaker Consensus Model." *Universität Innsbruck, Working Papers in Economics and Statistics* 2018-09. arXiv:1806.03208.

<a id="spi"></a>**[FiveThirtyEight]** Boice, J., & Silver, N. "How Our Club Soccer Predictions Work." *FiveThirtyEight* (2017). <https://fivethirtyeight.com/methodology/how-our-club-soccer-predictions-work/>

<a id="knuth"></a>**[Knuth 1997]** Knuth, D. E. (1997). *The Art of Computer Programming, Vol. 2: Seminumerical Algorithms* (3rd ed.), §3.4.1. Addison-Wesley. (Poisson sampling by the multiplication method.)

<a id="metropolis"></a>**[Metropolis-Ulam 1949]** Metropolis, N., & Ulam, S. (1949). "The Monte Carlo Method." *Journal of the American Statistical Association*, 44(247), 335–341.

<a id="kuhn"></a>**[Kuhn 1955]** Kuhn, H. W. (1955). "The Hungarian method for the assignment problem." *Naval Research Logistics Quarterly*, 2(1–2), 83–97.

<a id="apesteguia"></a>**[Apesteguia-PH 2010]** Apesteguia, J., & Palacios-Huerta, I. (2010). "Psychological Pressure in Competitive Environments: Evidence from a Randomized Natural Experiment." *American Economic Review*, 100(5), 2548–2564.

<a id="fifa2026"></a>**[FIFA 2026]** FIFA. *Regulations — FIFA World Cup 2026™* (competition format and ranking-of-teams criteria). <https://www.fifa.com/>

<a id="fifasum"></a>**[FIFA SUM]** FIFA. *Revision of the FIFA / Coca-Cola World Ranking — Technical explanations* (Elo-based "SUM" method, importance-weighted K). <https://www.fifa.com/>

<a id="klement"></a>**[ESPN 2026]** "Mathematician who correctly predicted three World Cup winners in a row has named 2026 pick." *ESPN* (2026). <https://www.espn.com/soccer/story/_/id/48964113>

<a id="klementbein"></a>**[beIN 2026]** "Joachim Klement predicts the Netherlands to win the 2026 World Cup." *beIN Sports* (2026). <https://www.beinsports.com/>

---

*This methodology document is part of [StickerDex](../README.md) and, like the rest of the project,
is provided for educational and entertainment purposes.*
