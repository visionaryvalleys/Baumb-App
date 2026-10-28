# Baumb Adaptive Progressive-Overload System

## Research Report and Backend Implementation Specification

**Version:** 1.0\
**Prepared:** 25 October 2026\
**Scope:** Adults aged 18+; India-first, internationally adaptable\
**Purpose:** Translate current resistance-training evidence into a
cautious, auditable, goal-aware progression engine.

> **Important:** This is a product and evidence synthesis, not a
> clinical guideline or individualized medical prescription.
> Recommendations for rehabilitation, injury, pregnancy/postpartum,
> chronic disease, or unexplained symptoms require an appropriate
> clinician-defined pathway. The cited research is strongest for healthy
> adults and does not establish a uniquely optimal prescription for
> every muscle, machine, sex, or goal.

------------------------------------------------------------------------

## Executive summary

Baumb should implement a **hybrid adaptive engine**: deterministic rules
and calculations make safety-critical training decisions; the AI layer
explains those decisions, asks for missing context, and helps users
understand options, but cannot override safety rules or fabricate
scientific certainty.

Progressive overload means progressively increasing the training
challenge in a way that is appropriate to the goal and recoverable by
the person. It is not synonymous with adding weight every workout. Valid
progression can include more repetitions at a given load, a small load
increase at a similar effort, more high-quality sets when justified,
improved standardized range of motion or technique, better performance
at the same effort, or goal-specific increases in speed/power. These
measures must be tracked separately because they are not
interchangeable.

### Core decisions

1.  **Separate goal-specific outcome tracking.** Scale weight is
    important for weight-loss/gain goals but cannot by itself measure
    hypertrophy or recomposition.
2.  **Treat exercise identity as more than a name.** Store the movement
    pattern, target muscles, equipment, machine model where known,
    setup, range of motion, grip/stance, unilateral/bilateral status,
    and load units.
3.  **Progress from reliable session data.** Compare like with like:
    same exercise variant, setup, technique standard, and comparable
    effort.
4.  **Account for indirect muscle work.** A chest press contributes to
    chest, triceps, and anterior deltoid work, but do not count every
    compound set as a full direct set for every involved muscle without
    a documented model.
5.  **Use starting ranges, not false precision.** Research supports
    broad patterns (for example, multiple weekly sets for hypertrophy),
    not one exact optimal set target for every muscle and person.
6.  **Adapt at three timescales.** Session-level decisions adjust the
    next exposure; weekly reviews assess adherence, volume, recovery and
    trend; monthly reviews assess whether the plan is producing the
    desired outcome.
7.  **Represent uncertainty.** Missing logs, inaccurate RIR estimates,
    changed machine settings, illness, and noisy body-composition
    readings reduce confidence.
8.  **Preserve existing Baumb functionality.** Before implementation,
    map this specification onto the current React Native/Expo app, APIs,
    authentication, database, state, integrations and business logic.
    Reuse existing records where possible; do not replace them based on
    this document alone.

## 1. What the evidence supports---and what it does not

### 1.1 Evidence hierarchy

Use evidence in the following order when answering broad programming
questions: - Overviews of systematic reviews / umbrella reviews and
high-quality systematic reviews with meta-analysis. - Randomized
controlled trials that directly test a defined exercise or programming
comparison. - Professional position stands and public-health guidelines
that synthesize evidence. - Biomechanical and EMG studies to understand
movement or activation, not to claim proven long-term growth. - Coaching
heuristics only when clearly labelled as heuristics and monitored
against outcomes.

Evidence quality depends on the question. A large meta-analysis of
healthy adults is useful for general programming, but may not answer a
question about a specific machine, individual muscle head, older adult,
or injured population.

### 1.2 High-value research

1.  **Currier et al. (2026), ACSM Position Stand:** *Resistance Training
    Prescription for Muscle Function, Hypertrophy, and Physical
    Performance in Healthy Adults: An Overview of Reviews.* Synthesizes
    137 systematic reviews and more than 30,000 participants. It reports
    that heavier loads (about ≥80% 1RM), full range of motion, 2--3
    sets, exercise placement early in a session and at least
    twice-weekly exposure support strength; higher weekly volumes
    (around ≥10 sets/week) support hypertrophy on average. Training to
    momentary failure, equipment type, exercise complexity, time under
    tension and periodization did not consistently improve outcomes
    across the reviewed evidence. The conclusions apply to healthy
    adults and do not mean every person needs these exact
    prescriptions.\
    Links: https://pubmed.ncbi.nlm.nih.gov/41843416/ \|
    https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/\
    Evidence interpretation: **High confidence for broad principles;
    lower confidence for muscle-specific exact targets.**

2.  **Currier et al. (2023), British Journal of Sports Medicine:**
    *Resistance training prescription for muscle strength and
    hypertrophy in healthy adults: a systematic review and Bayesian
    network meta-analysis.* Strength network: 178 studies, 5,097
    participants; hypertrophy network: 119 studies, 3,364 participants.
    Heavier loads ranked well for strength; multiple sets ranked well
    for hypertrophy. Many comparisons between prescriptions were not
    clearly different, so rankings are not universal individual
    prescriptions.\
    Links: https://bjsm.bmj.com/content/57/18/1211 \|
    https://pubmed.ncbi.nlm.nih.gov/37414459/\
    Evidence interpretation: **High confidence that many approaches
    work; moderate confidence in ranking specific combinations.**

3.  **Refalo et al. (2022), Frontiers in Sports and Active Living:**
    *Resistance Training Variables for Optimization of Muscle
    Hypertrophy: An Umbrella Review.* Synthesizes 14 meta-analyses,
    covering 178 primary studies and 4,784 participants. Useful for
    weekly volume, load, exercise order and other hypertrophy
    variables.\
    Links: https://pmc.ncbi.nlm.nih.gov/articles/PMC9302196/ \|
    https://doi.org/10.3389/fspor.2022.949021\
    Evidence interpretation: **Moderate-to-high for broad training
    variables; heterogeneous underlying studies.**

4.  **Robinson et al. (2024), Sports Medicine:** *Exploring the
    Dose-Response Relationship Between Estimated Resistance Training
    Proximity to Failure, Strength Gain, and Muscle Hypertrophy.* The
    exploratory meta-regression suggests hypertrophy tends to increase
    as sets finish closer to failure, while strength changes show a
    weaker relationship; RIR estimates and model fit limit precision.\
    Link: https://pubmed.ncbi.nlm.nih.gov/38970765/\
    Evidence interpretation: **Moderate; do not mandate failure.**

5.  **Pelland et al. / authors as indexed (2023), systematic review and
    meta-analysis:** *Effect of free-weight vs. machine-based strength
    training on maximal strength, hypertrophy and jump performance.*
    Thirteen studies, 1,016 participants. No clear hypertrophy advantage
    for machines or free weights; strength gains are specific to the
    test and modality.\
    Link: https://pubmed.ncbi.nlm.nih.gov/37582807/\
    Evidence interpretation: **Moderate; limited number of direct
    hypertrophy comparisons.**

6.  **Binmahfoz et al. (2025), BMJ Open Sport & Exercise Medicine:**
    *Effect of resistance exercise on body composition, muscle strength
    and cardiometabolic health during dietary weight loss in people
    living with overweight or obesity.* In adults with
    overweight/obesity undertaking dietary weight loss, resistance
    exercise helped preserve fat-free mass and increased fat loss versus
    diet-only comparison in the included trials.\
    Link: https://pubmed.ncbi.nlm.nih.gov/40909191/ \|
    https://doi.org/10.1136/bmjsem-2024-002363\
    Evidence interpretation: **Moderate for preserving fat-free mass;
    outcome certainty differs by endpoint.**

7.  **Murphy & Koehler (2022), Scandinavian Journal of Medicine &
    Science in Sports:** *Energy deficiency impairs resistance training
    gains in lean mass but not strength: A meta-analysis and
    meta-regression.* A calorie deficit can constrain lean-mass gains
    even where strength improves.\
    Link: https://pubmed.ncbi.nlm.nih.gov/34623696/\
    Evidence interpretation: **Moderate; deficit size, baseline body
    composition and training status matter.**

8.  **Sex differences in muscle-size changes (2025), systematic review
    with Bayesian meta-analysis:** Relative hypertrophy responses were
    broadly similar between healthy adult males and females, while
    absolute size changes differed slightly.\
    Link: https://pubmed.ncbi.nlm.nih.gov/40028215/\
    Evidence interpretation: **Moderate; evidence is less complete for
    elite athletes, gender-diverse populations, and some life stages.**

9.  **WHO physical-activity guidance:** Adults should perform
    muscle-strengthening activities involving all major muscle groups on
    at least two days per week. This is a public-health baseline, not an
    optimized bodybuilding prescription.\
    Link: https://www.ncbi.nlm.nih.gov/books/NBK566046/\
    Evidence interpretation: **Strong public-health recommendation.**

### 1.3 Evidence-confidence labels in Baumb

-   **High:** multiple high-quality reviews or consistent evidence; safe
    to use as a general default.
-   **Moderate:** evidence supports a direction, but optimal dose or
    subgroup effects are uncertain.
-   **Low:** small, indirect, heterogeneous, or observational evidence;
    use conservatively and personalize.
-   **Insufficient:** no defensible specific rule; avoid pretending
    there is a scientifically established answer.

Every recommendation should carry: evidence source(s), confidence label,
population applicability, date reviewed, rule version, and whether the
value is evidence-derived or a product heuristic.

## 2. Goal classification and what "progress" means

Goals may coexist. Ask the user to choose a primary goal and optional
secondary goals, then set priorities and trade-offs.

  ----------------------------------------------------------------------------
  Goal              Primary success       Training          Important caveat
                    metrics               progression       
                                          priority          
  ----------------- --------------------- ----------------- ------------------
  Fat loss          7-day average body    Maintain or       Fat loss is
                    weight, waist trend,  improve           primarily driven
                    adherence, strength   performance and   by sustained
                    retention, estimated  preserve lean     energy balance;
                    fat-mass trend if     tissue; do not    lifting supports
                    measurement quality   automatically     body composition
                    permits               increase lifting  and function
                                          volume to         
                                          accelerate scale  
                                          loss              

  Recomposition     Waist and weight      Progressive       Scale weight can
                    trends, performance,  resistance        change slowly
                    standardized          training,         despite
                    photos/measurements   adequate recovery improvements;
                    if consented          and nutrition;    body-fat estimates
                                          assess over       can be noisy
                                          several weeks     

  Hypertrophy       Exercise performance, More high-quality Do not equate
                    weekly hard sets by   stimulus over     pump, soreness or
                    muscle, standardized  time, adequate    EMG with measured
                    circumference or      effort, volume    muscle growth
                    validated             tolerated and     
                    body-composition      recoverable       
                    trend                                   

  Strength          Load/reps on          Practice the      Strength is
                    standardized lifts,   target movement;  task-specific;
                    estimated 1RM where   heavier loads     machine and
                    valid, technique and  when appropriate; free-weight PRs
                    test specificity      manage fatigue    are not
                                                            interchangeable

  Weight gain       Average body-weight   Train to build    Scale gain can be
                    trend, performance,   muscle; ensure    fat, water,
                    waist and other       adequate energy   glycogen or lean
                    composition           availability      tissue; do not
                    indicators                              label it muscle
                                                            gain without
                                                            evidence

  Athletic          Sport-specific tests, Match resistance  Sport coach /
  performance       speed/power, workload work to sport     qualified
                    tolerance, skill and  demands and       professional may
                    availability          periodization     need to set
                                                            priorities;
                                                            generic
                                                            hypertrophy rules
                                                            may conflict with
                                                            competition

  Muscular          Repetitions or work   Increase          Endurance
  endurance         completed at          repeatable work   programming
                    standardized load,    capacity while    differs from
                    duration and recovery preserving        maximal-strength
                                          technique         priorities

  General health    Consistency,          Sustainable       Avoid promising
                    functional ability,   full-body         disease prevention
                    strength, physical    training and      or treatment from
                    activity and          adherence         a workout score
                    user-relevant health                    
                    metrics                                 

  Rehabilitation /  Clinician-defined     Only within       Not an autonomous
  return to         function, symptoms,   restrictions and  general-fitness
  training          tolerance and staged  progression       algorithm; red
                    milestones            criteria supplied flags or worsening
                                          by clinician      symptoms trigger
                                                            referral
  ----------------------------------------------------------------------------

### Goal priority logic

1.  Safety and clinician restrictions.
2.  User's primary goal and explicit constraints.
3.  Sport/competition deadlines if relevant.
4.  Training adherence and realistic available time.
5.  Secondary goals.
6.  Optimization within the above.

Do not assume "weight loss" means the user wants maximum strength loss
tolerated, or that "weight gain" means unrestricted mass gain.

## 3. User profile and personalization inputs

### Required for basic workout progression

-   Adult eligibility / date of birth or age band.
-   Goal(s), priority, and goal review date.
-   Training experience (novice, intermediate, advanced as operational
    categories, not immutable labels).
-   Planned training days, session duration and split.
-   Exercise list and stable exercise-variant IDs.
-   Sets, reps, load, unit, rest where available, and set completion
    status.
-   Effort measure (RPE or RIR) when user can provide it.
-   Known pain, injury restriction or exercise contraindication relevant
    to training.
-   Equipment access and available increments.

### Useful but optional

-   Body weight history and waist measurements.
-   Nutrition intake/targets, steps, sleep and subjective readiness.
-   Soreness, motivation, stress, illness and missed sessions.
-   Wearable data with source and reliability metadata.
-   Relevant sex-related variables only when they can change the
    recommendation and the user consents. Gender identity should be
    treated respectfully and should not be used as a proxy for
    physiology.

### Data-quality rules

-   Keep raw user entries immutable or auditable; store corrections as
    edits with timestamps.
-   Store local workout date, UTC timestamp and IANA timezone.
-   Preserve historical goal, body weight, target and program snapshots
    so old recommendations can be reproduced.
-   Record whether data is user-entered, device-imported, inferred,
    estimated or clinician-supplied.
-   Missing data is not zero. Do not infer a missed workout's
    performance or a missing meal's calories.
-   Use Monday--Sunday weeks by default, but calculate with the user's
    timezone and make the week definition explicit.
-   Never infer muscle gain directly from scale weight alone.

## 4. Exercise and equipment knowledge model

### 4.1 Exercise is a structured object

Each exercise variant should include: - `exercise_id`, canonical name,
aliases and localization keys. - Movement pattern and joint actions. -
Primary, secondary and stabilizing muscles with evidence/source and
confidence. - Equipment category: selectorized machine, plate-loaded
machine, cable, free weight, Smith machine, bodyweight, band, home
equipment or cardio machine. - Machine brand/model when known;
machine-specific load path and units where available. - Setup: seat,
pad, pulley, grip, stance, range-of-motion cues and side
(left/right/bilateral). - Resistance profile if known; do not fabricate
torque curves. - Permitted substitutions with reasons and similarity
confidence. - Exercise-specific safety notes and exclusions. -
Standardization instructions for repeatable comparison. - Whether
load/reps, time, distance, speed, watts or another metric is the primary
progression variable.

### 4.2 Muscle map starter taxonomy

The database should cover at least: - Chest: pectoralis major
(clavicular and sternocostal regions), pectoralis minor as a
secondary/stabilizing structure. - Back: latissimus dorsi, trapezius
(upper/middle/lower), rhomboids, teres major, spinal erectors; rotator
cuff as a separate shoulder-health category. - Shoulder: anterior,
lateral and posterior deltoid; rotator cuff muscles. - Elbow flexors:
biceps brachii (long/short heads), brachialis, brachioradialis. - Elbow
extensors: triceps long, lateral and medial heads. - Forearm/wrist:
flexors, extensors, pronators, supinators and grip musculature. -
Quadriceps: rectus femoris, vastus lateralis, medialis and
intermedius. - Hamstrings: biceps femoris long/short heads,
semitendinosus and semimembranosus. - Gluteal muscles: gluteus maximus,
medius and minimus. - Calves: gastrocnemius and soleus; tibialis
anterior and other lower-leg muscles as needed. - Hip/adductors:
adductor group, gracilis, sartorius and hip flexors. - Trunk: rectus
abdominis, obliques, transverse abdominis, spinal erectors and other
relevant stabilizers. - Neck and other smaller groups only with
appropriate exercise evidence and safety scope.

This is a taxonomy, not a claim that every muscle needs an isolated
exercise. Muscle involvement should be represented as a relationship
with confidence, not a simplistic "exercise equals one muscle" label.

### 4.3 Example exercise mapping

  ------------------------------------------------------------------------------
  Muscle / function       Candidate exercises and        Programming notes
                          equipment                      
  ----------------------- ------------------------------ -----------------------
  Chest pressing          Machine chest press,           Standardize bench
                          Smith/free-weight press,       angle, grip, depth and
                          push-up                        setup; pressing also
                                                         loads triceps/anterior
                                                         deltoid

  Chest adduction         Pec deck, cable fly            Track range and
                                                         shoulder comfort; not a
                                                         substitute for all
                                                         pressing patterns

  Lats / vertical pull    Lat pulldown, assisted         Standardize grip, torso
                          pull-up, pull-up               angle and pull endpoint

  Mid-back / horizontal   Chest-supported row, seated    Note elbow path and
  pull                    cable row, machine row         torso support; variants
                                                         are not perfectly
                                                         interchangeable

  Deltoids                Shoulder press, lateral raise, Separate anterior,
                          reverse pec deck/cable         lateral and
                          rear-delt raise                posterior-delt
                                                         exposure; presses do
                                                         not fully replace
                                                         direct lateral/rear
                                                         work

  Elbow flexors           Cable/DB curl, preacher curl,  Grip and shoulder
                          hammer curl                    position alter
                                                         emphasis; log variants
                                                         separately

  Triceps                 Cable pushdown, overhead       Overhead extension
                          extension, dip/press variant   places the long head in
                                                         a different shoulder
                                                         position; tolerance
                                                         varies

  Quadriceps              Leg extension, squat, hack     Record machine,
                          squat, leg press               seat/foot placement and
                                                         depth; knee/hip
                                                         mechanics differ

  Hamstrings              Seated/lying leg curl,         Knee flexion and
                          Romanian deadlift              hip-hinge patterns
                                                         provide different
                                                         functions; consider
                                                         both if appropriate

  Glutes                  Hip thrust, squat/leg press    Do not assume all
                          variant, hip hinge, hip        exercises train all
                          abduction                      gluteal regions equally

  Calves                  Standing and seated calf raise Knee position changes
                                                         gastrocnemius/soleus
                                                         contribution;
                                                         standardize stretch and
                                                         endpoint

  Trunk                   Cable crunch, ab machine,      Choose the intended
                          controlled                     trunk function; do not
                          anti-extension/anti-rotation   score uncontrolled
                          exercise                       repetitions as progress

  Cardio                  Treadmill, cycle, rower,       Track time, distance,
                          elliptical                     pace, power or
                                                         heart-rate zones as
                                                         relevant; don't treat
                                                         cardio load like
                                                         resistance-machine
                                                         kilograms
  ------------------------------------------------------------------------------

Exercise selection should consider goal, anatomy, available equipment,
skill, comfort, constraints and user preference. EMG alone should not
determine exercise ranking.

## 5. Starting programming ranges: configurable defaults, not laws

For healthy adults pursuing general hypertrophy, a conservative initial
template may use: - Most exercises in a practical range such as 6--15
repetitions, with broader ranges allowed where equipment, goal and skill
justify them. - Often 2--3 working sets per exercise to begin, adjusted
for experience and session time. - A starting target of roughly 1--4
repetitions in reserve (RIR) for many hypertrophy sets, with technique
and exercise risk influencing how close to failure to train. - A broad
initial target such as 6--10 challenging weekly sets for a muscle for
many novices/intermediates, with progression toward higher volume only
when the user benefits and recovers. This is a product starting range,
not a universal evidence-derived optimum. - Around 10+ weekly sets per
muscle as a reference that may support greater hypertrophy on average,
not a requirement and not automatically appropriate for all
muscles/users. - Rest long enough to preserve intended performance and
technique; use longer rest for demanding strength sets and shorter rest
only when it does not compromise the goal. - At least two weekly
exposures to major muscle groups as a flexible default when schedule
permits, but one-day-per-week splits can still work if weekly volume and
adherence are appropriate.

These defaults should be stored as configurable, versioned policies. A
plan must not be considered poor merely because it does not match a
single "optimal" split.

### Splits supported

-   Push / Pull / Legs.
-   Bro split / one muscle group per day.
-   Upper / Lower.
-   Full body.
-   Arnold split.
-   User-created and hybrid splits.

A split is a scheduling format, not a physiological law. The engine
should calculate each muscle's total weekly exposure across all days and
avoid double-counting indirect work as full direct volume without a
validated rule.

## 6. Progression engine

### 6.1 Supported progression dimensions

1.  **Repetition progression:** more valid repetitions at the same load
    and comparable effort.
2.  **Load progression:** a small increase while staying within the
    target rep/effort range.
3.  **Set progression:** add work only when current work is tolerated,
    adherence is adequate and outcome progress justifies it.
4.  **Technique / range standardization:** recognize improvement in
    execution, but do not equate an arbitrary technique change with a
    load PR.
5.  **Density / rest:** use only when relevant to the goal and when
    reduced rest does not undermine strength/hypertrophy work.
6.  **Power / endurance progression:** use goal-specific measures such
    as bar speed, watts, distance, work duration or standardized
    repetitions.
7.  **Consistency progression:** when adherence is low, the best
    intervention may be a more achievable plan, not higher load.

### 6.2 Double progression as a transparent default

Example for a machine chest press: 3 sets, target 8--12 reps, current
load 20 kg. - Session A: 10, 9, 8 reps, estimated 2 RIR. - Later: 11,
10, 9 at comparable effort. - Eventually: 12, 12, 12 with standardized
technique and target effort. - If the machine permits a small increment,
increase to the next load and expect repetitions to fall within the
target range. - If the next increment is too large, use microloading if
supported, build repetitions/effort tolerance, or use an approved
alternative---not forced form breakdown.

The exact rep range and "all sets reach top of range" rule are
programming heuristics. The user should not be penalized if a session is
affected by sleep, illness, stress, cycle-related symptoms, equipment
change or other context.

### 6.3 Session-level decision flow

1.  **Safety gate:** review new pain, injury restrictions, illness,
    dizziness/chest symptoms or clinician restrictions. If a red flag
    exists, do not issue a load-increase recommendation.
2.  **Data-quality gate:** confirm exercise variant, load units,
    completed sets, rep validity and whether setup/technique changed.
3.  **Compare like with like:** compare with recent exposures for the
    same variant and comparable effort; do not compare different machine
    models as identical kilograms.
4.  **Assess performance:** load, valid reps, set count, RIR/RPE, range
    standardization and rest.
5.  **Assess context:** recent missed sessions, soreness, sleep/stress
    if available, illness, nutrition/energy deficit and user-reported
    readiness. These are modifiers, not definitive recovery
    measurements.
6.  **Choose one primary action:** increase reps, maintain and collect
    more data, increase load, adjust sets, reduce load/volume
    temporarily, substitute exercise, or refer/stop.
7.  **Explain:** state the evidence-informed reason and uncertainty;
    never promise a specific amount of muscle gain.
8.  **Log the decision:** input snapshot, rule version, action,
    confidence, explanation, and user acceptance/rejection.

### 6.4 Suggested decision rules (initial product heuristics)

-   **Increase reps / maintain load:** performance is within the
    prescribed range and the user has not yet reached the target across
    sets.
-   **Consider load increase:** all prescribed sets reach the upper rep
    target with valid technique and intended effort on a comparable
    exposure; use the smallest practical increment.
-   **Hold and gather data:** one unusually good or poor session,
    uncertain RIR, changed machine/setup, incomplete log or conflicting
    signals.
-   **Reduce load for the session:** reps fall sharply or technique
    cannot be maintained at the planned load; first check rest, setup,
    illness, fatigue and whether the load was entered correctly.
-   **Consider a set increase:** the user has trained consistently for a
    review period, the muscle is not progressing on the chosen outcome,
    adherence and nutrition are adequate, current volume is tolerable,
    and no obvious program issue explains the stall.
-   **Reduce volume / deload consideration:** multiple exposures show
    persistent performance decline, unusually high fatigue, worsening
    soreness, low adherence due to workload, or other converging
    signals. No single soreness score should automatically trigger a
    deload.
-   **Do not progress load:** pain changes movement, a clinician
    restriction applies, technique standard is not met, or the data is
    not comparable.
-   **No automatic "failure" requirement:** failure is not needed as a
    universal condition for progression. Use more conservative effort
    targets for technically demanding or higher-risk movements.

These are **engineering heuristics**, not individually validated
clinical cutoffs. Store them as versioned policies and validate them
prospectively.

### 6.5 RIR / RPE mapping

A common practical mapping for resistance sets is: - RIR 4 ≈ RPE 6 - RIR
3 ≈ RPE 7 - RIR 2 ≈ RPE 8 - RIR 1 ≈ RPE 9 - RIR 0 ≈ RPE 10 / momentary
failure

This is approximate and user-dependent. Beginners may not estimate RIR
accurately. Ask for simple effort descriptions if needed, allow
"unknown," and avoid making large changes from one self-reported RIR
value.

### 6.6 Stalls and plateaus

A single bad workout is not a plateau. Define a configurable plateau
window, for example 3--5 comparable exposures without progress, then
inspect: - Was the exercise variant stable? - Was attendance adequate? -
Were sets performed at the planned effort? - Did load jumps exceed
equipment capability? - Was the user in a substantial energy deficit? -
Is the current volume too low, too high or poorly distributed? - Did
range of motion or technique change? - Are sleep, stress, pain or
illness likely confounders?

Change one major variable at a time when feasible, then observe the
response. The 3--5 exposure window is a product heuristic to validate,
not a proven universal threshold.

## 7. Weekly and monthly adaptation

### Weekly review

Calculate: - Planned versus completed sessions and sets. - Per-exercise
performance trend and valid exposure count. - Approximate direct and
indirect weekly work by muscle, with uncertainty. - Recent performance
declines or improvements. - User-reported fatigue, pain, soreness, sleep
and stress when available. - Weight trend using rolling averages; waist
trend only with consistent measurement protocol. - Nutrition/adherence
context if tracked. - Data coverage and confidence.

Actions may include maintaining the plan, redistributing volume across
days, reducing unnecessary overlap, adjusting a target range, or asking
the user a follow-up question. Do not increase volume just because a
week is labelled "low progress."

### Monthly review

Evaluate goal progress over a longer window: - Fat loss: weight trend,
waist, adherence, strength retention, energy and wellbeing. -
Recomposition: waist/body-weight trend plus performance; use
body-composition devices cautiously. - Hypertrophy: performance trend
and standardized measurements over sufficient time; no claim of muscle
growth from a single metric. - Strength: standardized lift or estimated
1RM trend, with technique and equipment consistency. - Weight gain:
average weight trend, performance and composition indicators. - Athletic
performance: sport-specific measures, fatigue and competition
calendar. - General health: adherence, functional outcomes and
user-relevant fitness markers. - Rehabilitation: only clinician-approved
milestones.

A monthly review should be able to conclude "insufficient data to
decide." That is a valid output.

## 8. Sex, gender, age and other personal factors

### Sex and gender

Use the same evidence-based progression foundation for all users.
Available research suggests relative hypertrophy responses can be
broadly similar between healthy adult males and females; do not
automatically assign women lighter loads, fewer sets or lower ambition.
Absolute strength, body size, exercise history and individual
performance are better inputs than gender stereotypes.

Collect sex-related variables only when relevant, consented and
appropriately protected. Menstrual-cycle phase should not trigger a
universal automatic deload or volume change; use the user's own symptom
and performance history if they want cycle-aware support.
Pregnancy/postpartum requires an appropriate screening and
professional-guidance pathway. Gender identity is not a direct measure
of hormonal status or training capacity.

### Age and training status

-   Adults 18+: general pathway with sensible beginner defaults.
-   Older adults: emphasize gradual progression, functional capacity,
    balance where appropriate, and health context; do not infer
    fragility from age alone.
-   Beginners: simpler exercises, more technique practice, conservative
    increments and education around effort.
-   Experienced users: use stable performance histories, finer load
    increments and more individualized volume decisions.
-   Advanced athletes: allow coach-defined periodization and
    sport-specific targets rather than claiming the generic algorithm is
    sufficient.

### Recovery signals

Soreness is not a reliable direct measure of muscle growth or recovery.
Sleep duration, wearable readiness, resting heart rate and HRV can be
noisy and person-specific. Use trends and multiple signals; do not label
an individual "recovered" based on a single device metric.

## 9. Safety, injuries and escalation

This engine is for fitness guidance, not diagnosis or autonomous
rehabilitation.

### Stop progression and escalate

-   Chest pain/pressure, fainting, severe or unusual breathlessness, new
    neurological symptoms, or other acute concerning symptoms: stop
    exercise and seek urgent medical evaluation appropriate to severity.
-   New severe pain, sudden loss of function, suspected
    fracture/dislocation, significant swelling, or rapidly worsening
    symptoms: stop the affected exercise and obtain medical assessment.
-   Persistent or recurrent pain, pain that changes movement, or an
    existing clinician restriction: pause the aggravating progression
    and refer to an appropriate clinician.
-   Known cardiovascular, metabolic, renal or other conditions,
    pregnancy/postpartum, medication effects, or recent surgery may
    require individualized professional guidance.

Do not encode detailed diagnosis or treatment pathways from general
resistance-training evidence. The system may support a
clinician-supplied restriction object, such as "avoid movement X until
date Y" or "progress only under clinician-defined criteria," with user
consent and access controls.

### Safety policy precedence

`emergency / red flag > clinician restriction > user stop/pain report > data validity > training goal > progression optimization`

The AI layer cannot override this precedence.

## 10. Backend architecture

### 10.1 Logical architecture

Existing mobile app (React Native / Expo)\
→ existing authentication and API boundary\
→ workout logging / exercise catalog / user profile / nutrition and body
metrics\
→ **Progression Decision Service**\
→ deterministic rule engine + evidence registry + goal-specific outcome
evaluator\
→ recommendation and explanation record\
→ existing app surfaces and notifications.

Do not create a parallel source of truth if existing Baumb entities
already represent these records. Inspect the repository and database
schema before mapping fields.

### 10.2 Core modules

1.  **Profile & Goal Service:** goals, constraints, training
    availability, user preferences.
2.  **Exercise Catalog:** anatomy mapping, variants, equipment and
    substitution relationships.
3.  **Session Normalizer:** unit conversion, valid-set checks,
    comparable exposure detection.
4.  **Training Load / Volume Calculator:** sets, reps, load, frequency,
    direct/indirect involvement with explicit uncertainty.
5.  **Progression Decision Engine:** deterministic, versioned rules.
6.  **Recovery & Safety Gate:** user reports, clinician restrictions and
    escalation.
7.  **Goal Outcome Evaluator:** goal-specific metrics and trend
    confidence.
8.  **Evidence Registry:** source metadata, evidence grades,
    recommendation links and review dates.
9.  **Explanation Service (Gemini):** natural-language rationale based
    only on structured decisions and approved evidence; no authority to
    modify decisions.
10. **Audit / Monitoring:** decision logs, rule versions, user feedback,
    adverse-event signals and evaluation metrics.

### 10.3 Suggested entities

These are logical entities; map them to existing tables/collections
before implementing.

**UserTrainingProfile** - `user_id` - `age_band` or age / date-of-birth
reference according to privacy policy - `experience_level` -
`primary_goal`, `secondary_goals[]`, `goal_priority` -
`training_days[]`, `session_duration_target` - `preferred_split_id` -
`equipment_access[]` - `constraints[]` - `timezone` - `created_at`,
`updated_at`, `schema_version`

**ExerciseVariant** - `exercise_variant_id`, `canonical_exercise_id` -
`equipment_type`, `machine_brand_model` (nullable) - `load_unit`,
`increment_size` (nullable) - `movement_pattern`, `joint_actions[]` -
`primary_muscles[]`, `secondary_muscles[]`, `stabilizers[]` -
`setup_parameters`, `technique_standard`, `rom_standard` -
`substitution_ids[]`, `safety_flags[]` - `mapping_confidence`,
`source_refs[]`, `catalog_version`

**WorkoutSession / SetLog** - session: `session_id`, `user_id`,
timestamps, local date, timezone, plan snapshot, completion status -
set: `set_id`, `session_id`, `exercise_variant_id`, order, set type,
load value/unit, reps, duration/distance where applicable, RPE/RIR,
rest, completion, technique/ROM flags, pain flag, notes, data source -
preserve edit history and distinguish planned values from completed
values.

**ProgressionRecommendation** - `recommendation_id`, `user_id`,
`exercise_variant_id` - `action_type` (increase_reps, increase_load,
maintain, adjust_sets, reduce_load, reduce_volume, substitute,
ask_question, stop_and_refer) - `target_load`, `target_rep_range`,
`target_sets`, `target_rir` where applicable - `reason_codes[]`,
`evidence_refs[]`, `confidence` - `input_snapshot_id`, `rule_version`,
`created_at`, `expires_at` - `accepted / edited / rejected / completed`
feedback.

**MuscleExposureSummary** - `user_id`, muscle ID, period start/end -
direct sets, indirect sets (separate), exposure count, confidence,
exercise variants - avoid storing one falsely precise "effective set"
total unless the counting model is explicitly documented and validated.

**EvidenceRecord** - `evidence_id`, citation, DOI/PMID/URL, publication
year - study type, population, outcomes, main finding, limitations -
confidence grade, applicable goal/decision, review date, version.

**SafetyRestriction** - source (user / clinician / other), restriction
type, affected exercise/movement, start/end, clinician criteria if
supplied, consent/access metadata, status. Do not store unnecessary
medical details.

### 10.4 API contract examples

`POST /workout-sessions/{sessionId}/sets`\
Validate set data and append/update through existing API conventions.

`POST /progression/evaluate`\
Input: completed session reference, goal/profile version, recent
comparable exercise history.\
Output: action, next-session target, reason codes, confidence,
missing-data flags, safety status, rule version.

`GET /progression/recommendations?status=active`\
Return current recommendations with expiry and explanation.

`POST /progression/recommendations/{id}/feedback`\
Record accepted, edited, rejected or completed and the reason if
offered.

`GET /progression/reports/weekly` and `/monthly`\
Return metrics, coverage, trends, uncertainty and goal-specific
interpretation.

These are illustrative routes, not an instruction to break or replace
existing APIs. Align naming, authorization, idempotency and error
conventions with the live backend.

## 11. Decision engine pseudocode

``` text
evaluate_next_session(user, exercise, history, goal, safety_context):
    if safety_context.emergency_or_red_flag:
        return STOP_AND_ESCALATE

    if safety_context.active_clinician_restriction_blocks(exercise):
        return BLOCKED_BY_CLINICIAN_RESTRICTION

    if safety_context.pain_changes_movement or safety_context.new_concerning_pain:
        return HOLD_EXERCISE_AND_REFER_AS_APPROPRIATE

    normalized = normalize_units_and_variant(history)
    if normalized.data_quality < minimum_quality:
        return MAINTAIN_OR_ASK_FOR_MISSING_DATA

    comparable = select_comparable_exposures(normalized)
    if comparable.count < minimum_exposures:
        return CONSERVATIVE_TARGET_AND_COLLECT_DATA

    performance = evaluate_performance(comparable, target_range, effort, technique)
    context = evaluate_context(sleep, soreness, illness, adherence, nutrition_if_available)

    if persistent_decline(performance) and multiple_signals_support_fatigue(context):
        return CONSIDER_REDUCING_LOAD_OR_VOLUME

    if all_sets_at_top_of_range(performance)
       and technique_valid(performance)
       and intended_effort_met(performance)
       and load_increment_is_reasonable(exercise):
        return SMALL_LOAD_INCREASE

    if reps_can_progress_without_exceeding_target_effort(performance):
        return ADD_REPS_OR_MAINTAIN_LOAD

    if stall_over_review_window(performance)
       and adherence_adequate(context)
       and current_volume_tolerated(context):
        return REVIEW_EXERCISE_SELECTION_VOLUME_RECOVERY_AND_GOAL_ALIGNMENT

    return MAINTAIN_AND_REASSESS
```

`minimum_quality`, `minimum_exposures`, plateau windows and threshold
definitions must be versioned, tested and calibrated. The pseudocode
deliberately avoids unvalidated universal numerical thresholds.

## 12. Confidence and uncertainty model

Confidence should reflect the quality of evidence and the quality of the
user's data separately.

-   **Evidence confidence:** how well research supports the rule.
-   **Data confidence:** completeness, comparability and reliability of
    recent logs.
-   **Recommendation confidence:** confidence that the action is
    appropriate for this user now.

Example: a high-confidence general rule can still produce a
low-confidence user recommendation if the exercise changed machines, RIR
is unknown, or only one session is logged.

Recommended output: - `confidence_level`: high / medium / low. -
`confidence_reasons[]`: missing effort, changed variant, low exposure
count, conflicting recovery signals, etc. -
`what_would_improve_confidence[]`: log RIR, confirm machine, repeat
exposure, standardize range. - Do not present arbitrary percentages such
as "93% certain" unless statistically calibrated and validated.

## 13. Indian-first localization and accessibility

-   Store weights in kilograms by default; support pounds for
    international users.
-   Localize date/time, units, language, terminology, numerals and
    accessibility labels.
-   Support English and a staged expansion to Hindi, Telugu, Tamil and
    other languages with reviewed fitness terminology; do not rely on
    raw machine translation for safety instructions.
-   Exercise names should support local gym vocabulary and aliases while
    retaining canonical IDs.
-   Accommodate gyms with limited equipment and home training;
    substitution should preserve the intended movement pattern and goal
    as far as possible.
-   Nutrition integration may account for Indian foods and dietary
    patterns, but calorie/protein estimates must show source and
    uncertainty.
-   Keep costs, low-end Android performance, intermittent connectivity
    and data minimization in mind.
-   Store timestamps with IANA timezone; don't assume every Indian user
    follows the same routine.

## 14. Gemini / AI guardrails

Gemini may: - Explain why a recommendation was made. - Rephrase guidance
at the user's literacy/language level. - Ask a clarifying question if an
essential input is missing. - Offer safe alternatives from the approved
exercise catalog. - Summarize weekly/monthly trends using provided
facts.

Gemini must not: - Invent a study, DOI, result, muscle activation
ranking or machine specification. - Independently change target load,
sets or safety status outside the decision service. - diagnose injury,
prescribe rehabilitation, or override clinician restrictions. - infer
biological sex, hormone status, pregnancy, disability or medical
condition from name, appearance, gender identity or unrelated data. -
claim a user gained muscle or lost fat when the measurement does not
support it. - present uncertain estimates as measured facts.

Every AI explanation should receive the structured decision and its
permitted evidence list. Validate output schema and reject unsafe or
unsupported recommendations.

## 15. Testing and validation plan

### Unit tests

-   Kilograms/pounds conversion and machine-specific increments.
-   Rep-range progression and load-increase logic.
-   Invalid / missing / duplicate set records.
-   Exercise variant and setup mismatch.
-   RIR unknown or implausible values.
-   Direct vs indirect muscle volume accounting.
-   Safety restriction precedence.
-   Timezone boundaries and week summaries.
-   Recommendation expiry and idempotency.
-   Goal-specific metrics and missing-data cases.

### Scenario tests

1.  Beginner has one logged workout: no aggressive progression based on
    one exposure.
2.  Experienced lifter reaches top of rep range at target effort:
    propose smallest reasonable increment.
3.  Machine changes from one brand/model to another: do not compare load
    numbers as equivalent.
4.  User reports sharp pain or movement-altering pain: block load
    progression and route to safety flow.
5.  User in a calorie deficit shows stable weight but retains strength:
    do not assume failure because scale weight is unchanged for a few
    days.
6.  User has several missed workouts: rebuild consistency and
    re-establish a baseline rather than treating old loads as mandatory.
7.  Recovery signals conflict: maintain or ask, rather than overreacting
    to a single wearable score.
8.  User changes from hypertrophy to strength: adjust success metrics
    and exercise-specific priorities.
9.  User uses a bro split or PPL: calculate total weekly muscle exposure
    across days.
10. No recent body-composition data: state uncertainty rather than
    estimating muscle gain from weight alone.

### Prospective validation

-   Run recommendations in shadow mode before allowing automatic
    changes.
-   Compare engine suggestions with qualified coaches' reviews.
-   Measure recommendation acceptance, safe completion, session
    adherence, data completeness, progression stability, user-reported
    usefulness and adverse-event reports.
-   Audit outcomes by age band, sex where consented and appropriate,
    experience, equipment type and goal to identify inequitable
    performance.
-   Use preregistered evaluation criteria where feasible; monitor false
    progression, unnecessary regression, unsafe recommendations and
    hallucinated explanations.
-   Roll out gradually with feature flags, rule versioning and rollback.

## 16. Build sequence

**Phase 0 --- Repository and data audit** - Inventory current APIs,
auth, tables/collections, exercise records, workout logs, nutrition
records and existing calculations. - Map existing fields to the logical
model; document gaps and avoid duplicate sources of truth. - Identify
privacy, consent and retention requirements.

**Phase 1 --- Reliable logging and catalog** - Normalize exercise
variants, load units, set completion, effort and timezones. - Add
equipment increments, stable IDs and substitution relationships. - Add
evidence metadata to muscle mapping.

**Phase 2 --- Deterministic progression MVP** - Implement safety gates,
data-quality gates, rep/load progression, recommendations and audit
records. - Start with a narrow set of common exercises, then expand only
when catalog quality is adequate.

**Phase 3 --- Weekly/monthly evaluator** - Add muscle exposure
summaries, adherence, goal-specific trends and uncertainty. - Keep
estimates clearly labelled.

**Phase 4 --- AI explanations** - Add Gemini explanations after
deterministic decisions are stable. - Enforce schema validation,
evidence allowlists and safety precedence.

**Phase 5 --- Validation and scale** - Shadow mode, coach review,
usability tests, subgroup audits, localization and staged rollout.

## 17. Decisions still requiring product-owner approval

The report can guide development, but these operational choices must be
finalized against Baumb's real implementation: 1. Current backend
framework, database, API conventions and deployment environment. 2.
Existing workout/exercise/nutrition schemas and which fields are
authoritative. 3. Exact age/clinical eligibility policy and escalation
wording reviewed by qualified professionals. 4. Which health/wearable
integrations are actually available and consented. 5. Whether
recommendations are advisory only or can modify a user's planned workout
automatically. 6. Data retention, export/delete, consent, access
controls and applicable legal requirements. 7. Initial exercise catalog
scope and who validates exercise-muscle relationships. 8. The specific
metrics Baumb will use for each goal and how measurement limitations
will be explained. 9. How recommendation thresholds will be calibrated,
versioned and evaluated before full release.

## 18. References and further reading

1.  Currier BS, D'Souza AC, Singh MAF, et al. (2026). *Resistance
    Training Prescription for Muscle Function, Hypertrophy, and Physical
    Performance in Healthy Adults: An Overview of Reviews.* Medicine &
    Science in Sports & Exercise, 58(4), 851--872. DOI:
    https://doi.org/10.1249/MSS.0000000000003897. PubMed:
    https://pubmed.ncbi.nlm.nih.gov/41843416/
2.  Currier BS, McLeod JC, Banfield L, et al. (2023). *Resistance
    training prescription for muscle strength and hypertrophy in healthy
    adults: a systematic review and Bayesian network meta-analysis.*
    British Journal of Sports Medicine, 57, 1211--1220. DOI:
    https://doi.org/10.1136/bjsports-2023-106807.
    https://pubmed.ncbi.nlm.nih.gov/37414459/
3.  Refalo MC, et al. (2022). *Resistance Training Variables for
    Optimization of Muscle Hypertrophy: An Umbrella Review.* Frontiers
    in Sports and Active Living. DOI:
    https://doi.org/10.3389/fspor.2022.949021.
    https://pmc.ncbi.nlm.nih.gov/articles/PMC9302196/
4.  Robinson ZP, Pelland JC, Remmert JF, et al. (2024). *Exploring the
    Dose-Response Relationship Between Estimated Resistance Training
    Proximity to Failure, Strength Gain, and Muscle Hypertrophy: A
    Series of Meta-Regressions.* Sports Medicine, 54, 2209--2231. DOI:
    https://doi.org/10.1007/s40279-024-02069-2.
    https://pubmed.ncbi.nlm.nih.gov/38970765/
5.  *Effect of free-weight vs. machine-based strength training on
    maximal strength, hypertrophy and jump performance: a systematic
    review and meta-analysis.* https://pubmed.ncbi.nlm.nih.gov/37582807/
6.  Binmahfoz A, Dighriri A, Gray C, Gray SR. (2025). *Effect of
    resistance exercise on body composition, muscle strength and
    cardiometabolic health during dietary weight loss in people living
    with overweight or obesity: a systematic review and meta-analysis.*
    BMJ Open Sport & Exercise Medicine, 11, e002363. DOI:
    https://doi.org/10.1136/bmjsem-2024-002363.
    https://pubmed.ncbi.nlm.nih.gov/40909191/
7.  Murphy C, Koehler K. (2022). *Energy deficiency impairs resistance
    training gains in lean mass but not strength: A meta-analysis and
    meta-regression.* Scandinavian Journal of Medicine & Science in
    Sports, 32, 125--137. DOI: https://doi.org/10.1111/sms.14075.
    https://pubmed.ncbi.nlm.nih.gov/34623696/
8.  *Sex differences in absolute and relative changes in muscle size
    following resistance training in healthy adults: a systematic review
    with Bayesian meta-analysis.*
    https://pubmed.ncbi.nlm.nih.gov/40028215/
9.  World Health Organization. *WHO Guidelines on Physical Activity and
    Sedentary Behaviour: Recommendations.*
    https://www.ncbi.nlm.nih.gov/books/NBK566046/

------------------------------------------------------------------------

## Final product principle

Baumb should never reward load increases for their own sake. It should
reward **appropriate, repeatable progress toward the user's chosen
goal**, while protecting safety, recognizing uncertainty, and explaining
why the recommendation was made. The research provides strong
foundations, but the product must validate its specific decision rules
against real users and qualified professional review before claiming
that its recommendations are optimal.
