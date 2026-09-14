/* ================================================
   Laqtum — Interactive Learning Engine
   Pattern-Based Adaptive Aptitude Experience
   ================================================ */

const PreviewApp = (() => {
    // ---------- State ----------
    let state = 'DASHBOARD';
    let surveyStep = 0;
    let quizStep = 0;
    let selectedOption = null;
    let xp = 0;
    let streak = 1;
    let hearts = 5;
    let quizResults = [];  // { pattern, correct, responseTimeMs }
    let lessonStep = 0;
    let currentLesson = null;
    let engineReady = false;
    let questionStartTime = 0; // For tracking response speed
    let currentQuizQuestions = []; // Real content bank questions for diagnostic
    let currentPatternFlow = null; // Current pattern being taught
    let currentFlowEntries = []; // Entries for current teaching flow
    let currentFlowIndex = 0;

    // ---------- Data ----------
    const surveyQuestions = [
        {
            question: "How much Aptitude do you know?",
            options: [
                { text: "I'm completely new", level: 1 },
                { text: "I know basic concepts", level: 2 },
                { text: "I can solve, but need speed", level: 3 },
                { text: "I can solve most problems fast", level: 4 },
                { text: "I'm already advanced", level: 5 },
            ]
        },
        {
            question: "What's your main target?",
            options: [
                { text: "Campus Placements", level: 1 },
                { text: "Competitive Exams (SSC/Bank/CAT)", level: 2 },
                { text: "AMCAT / eLitmus", level: 3 },
                { text: "Brain training & fun", level: 4 },
                { text: "Government exams", level: 5 },
            ]
        }
    ];

    // Pattern display names for the UI
    const PATTERN_NAMES = {
        P1: 'Convert-to-Totals', P2: 'Ratio-Lock', P3: 'Rate × Time = Quantity',
        P4: 'Percent-as-Fraction', P5: 'Difference-Elimination', P6: 'Constant-Shift/Scale',
        P7: 'Anchor-to-100', P8: 'Complementary Counting', P9: 'Position-Mapping',
        P10: 'Constraint-Elimination', P11: 'Cyclicity & Recurrence', P12: 'Weighted Mixing'
    };

    const PATTERN_ICONS = {
        P1: '➕', P2: '⚖️', P3: '🚀', P4: '📊', P5: '🔍', P6: '📈',
        P7: '💯', P8: '🎯', P9: '🗺️', P10: '🧩', P11: '🔄', P12: '🧪'
    };

    // Mapping from topic IDs in the picker to the core patterns they teach
    // Maps each topic ID to its primary pattern AND the exact topic_costume values from its JSON files.
    // This ensures each topic only loads its own questions, not all questions from a shared pattern.
    const TOPIC_MAPPING = {
        // Arithmetic
        'percentages':      { pattern: 'P4', costumes: ['percentages', 'percentages-successive-change', 'population-growth'] },
        'profit-loss':      { pattern: 'P4', costumes: ['profit-and-loss', 'profit-loss-successive-discounts'] },
        'si-ci':            { pattern: 'P7', costumes: ['simple-interest', 'compound-interest'] },
        'ratio':            { pattern: 'P2', costumes: ['ratio-and-proportion'] },
        'hcf-lcm':          { pattern: 'P5', costumes: ['hcf-lcm-basic', 'traffic-lights', 'fraction-arithmetic', 'school-bell'] },
        'partnership':      { pattern: 'P2', costumes: ['partnership', 'partnerships'] },
        'mixtures':         { pattern: 'P6', costumes: ['mixtures'] },
        'age-problems':     { pattern: 'P2', costumes: ['problems-on-ages', 'age-problems'] },
        'averages':         { pattern: 'P6', costumes: ['averages', 'average', 'averages-and-weighted-mean'] },
        // Speed & Work
        'time-work':        { pattern: 'P3', costumes: ['time-and-work'] },
        'pipes':            { pattern: 'P3', costumes: ['pipes-and-cisterns'] },
        'tsd':              { pattern: 'P3', costumes: ['speed-and-distance'] },
        'trains':           { pattern: 'P3', costumes: ['trains'] },
        'boats':            { pattern: 'P3', costumes: ['boats-and-streams', 'wind-and-airplane', 'escalator', 'conveyor-belt'] },
        'races':            { pattern: 'P3', costumes: ['races'] },
        // Algebra & Numbers
        'linear-eq':        { pattern: 'P2', costumes: ['linear-equations'] },
        'quadratic':        { pattern: 'P2', costumes: ['quadratic-equations', 'pure-algebra', 'geometry-area', 'ages', 'numbers'] },
        'progressions':     { pattern: 'P6', costumes: ['progressions', 'arithmetic-progression', 'seating-arrangement-numbers', 'salary-increment', 'stadium-rows', 'savings-plan', 'brick-stacking', 'geometric-progression', 'bacteria-population', 'ball-bounce-height', 'medicine-dosage-decay', 'fractal-perimeter', 'harmonic-progression', 'resistors-parallel-circuit', 'work-rate-harmonic', 'means-comparison', 'average-speed-round-trip'] },
        'permutations':     { pattern: 'P8', costumes: ['permutation-combination', 'seating-committee', 'prize-distribution', 'password-codes', 'lock-combination', 'flag-signals', 'exam-answer-key', 'round-table-meeting', 'necklace-beads', 'family-dinner-seating', 'flag-arrangement', 'ball-arrangement', 'word-formation', 'bookshelf-arrangement', 'photo-lineup', 'exam-seating-block', 'quiz-team-selection', 'fruit-basket-selection', 'dice-rolls', 'code-word-vowels', 'license-plate-vowels', 'password-rank', 'code-rank', 'pin-code-formation', 'even-number-formation', 'city-block-navigation', 'robot-movement'] },
        'probability':      { pattern: 'P8', costumes: ['probability'] },
        'set-theory':       { pattern: 'P8', costumes: ['set-theory'] },
        'logarithms':       { pattern: 'P7', costumes: ['logarithms'] },
        'surds':            { pattern: 'P7', costumes: ['surds-and-indices'] },
        'number-systems':   { pattern: 'P11', costumes: ['number-system-unit-digit', 'number-system-remainders', 'number-system-digit-reversal'] },
        'remainders':       { pattern: 'P11', costumes: ['remainders'] },
        'number-series':    { pattern: 'P11', costumes: ['number-series'] },
        // Geometry & Mensuration
        'triangles':        { pattern: 'P1', costumes: ['triangles'] },
        'circles':          { pattern: 'P1', costumes: ['circles'] },
        'quadrilaterals':   { pattern: 'P1', costumes: ['quadrilaterals'] },
        'mensuration-2d':   { pattern: 'P1', costumes: ['mensuration-2d'] },
        'mensuration-3d':   { pattern: 'P1', costumes: ['mensuration-3d'] },
        'coordinate-geo':   { pattern: 'P9', costumes: ['coordinate-geometry'] },
        'trigonometry':     { pattern: 'P1', costumes: ['trigonometry'] },
        // Logical Reasoning
        'coding-decoding':  { pattern: 'P9', costumes: ['coding-decoding'] },
        'blood-relations':  { pattern: 'P10', costumes: ['blood-relations'] },
        'seating-linear':   { pattern: 'P10', costumes: ['seating-linear'] },
        'seating-circular': { pattern: 'P10', costumes: ['seating-circular'] },
        'puzzles-grid':     { pattern: 'P10', costumes: ['puzzles-and-grid'] },
        'clocks-calendars': { pattern: 'P11', costumes: ['clocks-and-calendars'] },
        'syllogisms':       { pattern: 'P10', costumes: ['syllogisms'] },
        'direction-test':   { pattern: 'P9', costumes: ['direction-test'] },
        'input-output':     { pattern: 'P11', costumes: ['input-output'] },
        // Data Interpretation
        'data-tables':      { pattern: 'P4', costumes: ['data-tables'] },
        'bar-charts':       { pattern: 'P4', costumes: ['bar-charts'] },
        'pie-charts':       { pattern: 'P4', costumes: ['pie-charts'] },
        'line-graphs':      { pattern: 'P4', costumes: ['line-graphs'] },
        'data-sufficiency': { pattern: 'P10', costumes: ['data-sufficiency'] }
    };

    // Backward-compat helper: get pattern for a topic id
    function getTopicPattern(topicId) {
        const m = TOPIC_MAPPING[topicId];
        return m ? m.pattern : null;
    }
    function getTopicCostumes(topicId) {
        const m = TOPIC_MAPPING[topicId];
        return m ? m.costumes : [];
    }

    // ---------- All Aptitude Topics & Subtopics (Comprehensive List) ----------
    const allAptitudeTopics = [
        // Arithmetic & Numbers
        { id: 'percentages', category: 'Arithmetic', icon: '📊', label: 'Percentages & Shortcuts', formula: 'Percentage = (Value / Total) × 100', example: 'Find 15% of 340: 10% is 34, 5% is 17. 34 + 17 = 51.', action: 'lesson-percentages' },
        { id: 'profit-loss', category: 'Arithmetic', icon: '💰', label: 'Profit, Loss & Discount', formula: 'Profit % = (Profit / CP) × 100 | SP = CP × (100 + P%) / 100', example: 'A watch bought for ₹500 is sold at 20% profit. SP = 500 × 1.20 = ₹600.' },
        { id: 'si-ci', category: 'Arithmetic', icon: '🏦', label: 'Simple & Compound Interest', formula: 'SI = (P × R × T) / 100 | CI = P(1 + R/100)ᵗ - P', example: 'SI on ₹1000 at 10% for 2 years: (1000 × 10 × 2)/100 = ₹200.' },
        { id: 'averages', category: 'Arithmetic', icon: '📈', label: 'Averages & Weighted Mean', formula: 'Average = Sum of all observations / Number of observations', example: 'Average of 20, 30, and 40 is (20 + 30 + 40)/3 = 30.' },
        { id: 'ratio', category: 'Arithmetic', icon: '⚖️', label: 'Ratio & Proportion', formula: 'If a:b = c:d, then a×d = b×c (Product of extremes = Product of means)', example: 'Divide ₹500 in ratio 2:3. First part = (2/5) × 500 = ₹200.' },
        { id: 'hcf-lcm', category: 'Arithmetic', icon: '🔗', label: 'HCF & LCM Concepts', formula: 'HCF(a, b) × LCM(a, b) = a × b', example: 'If HCF is 6 and product of numbers is 180, LCM = 180 / 6 = 30.' },
        { id: 'partnership', category: 'Arithmetic', icon: '🤝', label: 'Partnership & Share Allocation', formula: 'Profit Ratio = (Capital₁ × Time₁) : (Capital₂ × Time₂)', example: 'A invests ₹10k for 12 mos, B invests ₹20k for 6 mos. Ratio = 120k:120k = 1:1.' },
        { id: 'mixtures', category: 'Arithmetic', icon: '🧪', label: 'Mixture & Alligation', formula: 'Quantity of Cheaper / Quantity of Dearer = (d - m) / (m - c)', example: 'Mix milk @ ₹40/L with water @ ₹0/L to get average price ₹30/L. Ratio = (30-0)/(40-30) = 3:1.' },
        { id: 'age-problems', category: 'Arithmetic', icon: '🎂', label: 'Problems on Ages', formula: 'Let present age be x. Age t years ago = (x - t), after t years = (x + t)', example: 'Father is 3 times son\'s age. After 10 years, twice. Let son = x. 3x + 10 = 2(x + 10) => x = 10.' },
        // Speed & Work
        { id: 'time-work', category: 'Speed & Work', icon: '🔧', label: 'Time & Work Efficiency', formula: 'If A can do work in n days, 1 day\'s work = 1/n. Combined efficiency = 1/A + 1/B', example: 'A does work in 10 days, B in 15 days. 1/10 + 1/15 = 5/30 = 1/6. Total time = 6 days.' },
        { id: 'pipes', category: 'Speed & Work', icon: '🚰', label: 'Pipes & Cisterns', formula: 'Inlet pipe adds (+1/x), Outlet/leak empties (-1/y). Net fill rate = 1/x - 1/y', example: 'Inlet fills in 4h, outlet empties in 6h. Net rate = 1/4 - 1/6 = 1/12. Takes 12 hours.' },
        { id: 'tsd', category: 'Speed & Work', icon: '🚂', label: 'Time, Speed & Distance', formula: 'Distance = Speed × Time | 1 km/h = 5/18 m/s', example: 'Convert 72 km/h to m/s: 72 × (5/18) = 20 m/s.' },
        { id: 'trains', category: 'Speed & Work', icon: '🚄', label: 'Problems on Trains', formula: 'Time to cross stationary object of length L = (Train Length + L) / Speed', example: '150m train @ 15 m/s crosses 150m platform: Total dist = 300m. Time = 300 / 15 = 20 seconds.' },
        { id: 'boats', category: 'Speed & Work', icon: '⛵', label: 'Boats & Streams', formula: 'Downstream = u + v | Upstream = u - v | Boat in still water u = (D + U)/2', example: 'Downstream speed is 14 km/h, Upstream is 8 km/h. Boat speed = (14+8)/2 = 11 km/h.' },
        { id: 'races', category: 'Speed & Work', icon: '🏁', label: 'Races & Games of Skill', formula: 'If A gives B a start of x meters in an L meter race, A runs L while B runs (L - x)', example: 'In 100m race, A beats B by 10m. When A finishes 100m, B is at 90m. Speed ratio = 10:9.' },
        // Algebra & Numbers
        { id: 'linear-eq', category: 'Algebra', icon: '✖️', label: 'Linear Equations', formula: 'ax + by = c | Solve using substitution or elimination', example: 'If x + y = 10 and x - y = 4, adding gives 2x = 14 => x = 7, y = 3.' },
        { id: 'quadratic', category: 'Algebra', icon: '📐', label: 'Quadratic Equations', formula: 'Roots of ax² + bx + c = 0 are [-b ± √(b² - 4ac)] / 2a', example: 'For x² - 5x + 6 = 0, roots are x = 2 and x = 3.' },
        { id: 'progressions', category: 'Algebra', icon: '🪜', label: 'Progressions (AP, GP, HP)', formula: 'AP nth term: Tₙ = a + (n-1)d | GP nth term: Tₙ = a × rⁿ⁻¹', example: '10th term of AP 2, 5, 8, ...: T₁₀ = 2 + (10-1)×3 = 2 + 27 = 29.' },
        { id: 'permutations', category: 'Algebra', icon: '🔄', label: 'Permutations & Combinations', formula: 'ⁿPᵣ = n! / (n-r)! | ⁿCᵣ = n! / [r!(n-r)!]', example: 'Ways to choose 2 people from 5: ⁵C₂ = (5×4) / (2×1) = 10 ways.' },
        { id: 'probability', category: 'Algebra', icon: '🎲', label: 'Probability Concepts', formula: 'P(Event) = Favorable Outcomes / Total Possible Outcomes', example: 'Probability of getting an even number on a six-sided die = 3/6 = 1/2.' },
        { id: 'set-theory', category: 'Algebra', icon: '⭕', label: 'Set Theory & Venn Diagrams', formula: 'n(A ∪ B) = n(A) + n(B) - n(A ∩ B)', example: 'If 30 like tea, 25 like coffee, and 10 like both, total = 30 + 25 - 10 = 45.' },
        { id: 'logarithms', category: 'Algebra', icon: '🪵', label: 'Logarithms & Properties', formula: 'log(ab) = log a + log b | log(a/b) = log a - log b | log(aⁿ) = n·log a', example: 'If log₂ 8 = x, then 2ˣ = 8, which means x = 3.' },
        { id: 'surds', category: 'Algebra', icon: '⚡', label: 'Surds & Indices', formula: 'aᵐ × aⁿ = aᵐ⁺ⁿ | (aᵐ)ⁿ = aᵐⁿ | a⁻ⁿ = 1 / aⁿ', example: 'Simplify (2³)² × 2⁻⁴ = 2⁶ × 2⁻⁴ = 2² = 4.' },
        { id: 'number-systems', category: 'Algebra', icon: '🧮', label: 'Number Systems & Divisibility', formula: 'Divisibility by 3: Sum of digits divisible by 3. By 4: Last 2 digits divisible by 4', example: 'Check 4518: Sum = 4+5+1+8 = 18 (divisible by 3 and 9).' },
        { id: 'remainders', category: 'Algebra', icon: '🔢', label: 'Remainders & Modular Arithmetic', formula: 'Dividend = (Divisor × Quotient) + Remainder | Remainder theorem shortcuts', example: 'Remainder when 17 × 23 is divided by 5: (2 × 3) mod 5 = 6 mod 5 = 1.' },
        // Geometry & Mensuration
        { id: 'triangles', category: 'Geometry', icon: '🔺', label: 'Triangles & Properties', formula: 'Area = ½ × base × height | Pythagoras: a² + b² = c²', example: 'In right triangle with sides 6 and 8, hypotenuse = √(36 + 64) = √100 = 10.' },
        { id: 'circles', category: 'Geometry', icon: '⭕', label: 'Circles, Tangents & Chords', formula: 'Area = πr² | Circumference = 2πr | Tangent is perpendicular to radius', example: 'Circle with radius 7 cm has circumference = 2 × (22/7) × 7 = 44 cm.' },
        { id: 'quadrilaterals', category: 'Geometry', icon: '⬜', label: 'Quadrilaterals & Polygons', formula: 'Sum of interior angles of n-sided polygon = (n - 2) × 180°', example: 'For a hexagon (n=6), sum of angles = (6-2) × 180° = 4 × 180° = 720°.' },
        { id: 'mensuration-2d', category: 'Geometry', icon: '📏', label: '2D Mensuration (Area & Perimeter)', formula: 'Rectangle Area = l × b | Trapezium Area = ½(a + b) × h', example: 'Trapezium with parallel sides 10 and 14, height 5: Area = ½(24) × 5 = 60.' },
        { id: 'mensuration-3d', category: 'Geometry', icon: '🧊', label: '3D Mensuration (Volume & Surface Area)', formula: 'Cylinder Volume = πr²h | Sphere Volume = (4/3)πr³ | Cone Volume = (1/3)πr²h', example: 'Cylinder with r=7, h=10: Volume = (22/7) × 49 × 10 = 1540 cubic units.' },
        { id: 'coordinate-geo', category: 'Geometry', icon: '📍', label: 'Coordinate Geometry', formula: 'Distance = √[(x₂-x₁)² + (y₂-y₁)²] | Midpoint = ((x₁+x₂)/2, (y₁+y₂)/2)', example: 'Distance between (0,0) and (3,4) = √(9 + 16) = √25 = 5.' },
        { id: 'trigonometry', category: 'Geometry', icon: '📐', label: 'Trigonometry Basics & Heights', formula: 'sin θ = Opp/Hyp | cos θ = Adj/Hyp | tan θ = Opp/Adj | sin²θ + cos²θ = 1', example: 'If tree casts shadow equal to its height, tan θ = 1 => Angle of elevation = 45°.' },
        // Logical Reasoning
        { id: 'coding-decoding', category: 'Logical Reasoning', icon: '🔐', label: 'Coding-Decoding Patterns', formula: 'Analyze position shifts (+1, +2, reverse alphabet, opposite letter pairs)', example: 'If CAT is coded as DBU (+1 shift), then DOG is coded as EPH.' },
        { id: 'blood-relations', category: 'Logical Reasoning', icon: '👨‍👩‍👧', label: 'Blood Relations & Family Tree', formula: 'Use generation levels (+1 for parents, 0 for siblings/spouse, -1 for children)', example: 'A is B\'s brother, C is A\'s mother. Therefore C is B\'s mother.' },
        { id: 'seating-linear', category: 'Logical Reasoning', icon: '💺', label: 'Linear Seating Arrangement', formula: 'Establish left/right anchors carefully based on North/South facing directions', example: 'If A sits immediately right of B and left of C, sequence from left to right is B - A - C.' },
        { id: 'seating-circular', category: 'Logical Reasoning', icon: '⭕', label: 'Circular Seating Arrangement', formula: 'In circular seating facing center, right is counter-clockwise and left is clockwise', example: 'In a 4-person table facing center, opposite of person at 12 o\'clock is at 6 o\'clock.' },
        { id: 'puzzles-grid', category: 'Logical Reasoning', icon: '🧩', label: 'Logical Puzzles & Grid Matching', formula: 'Construct a multi-variable grid table to cross out contradictions clearly', example: 'If John wears red and lives in Paris, put ticks on diagonal grid intersections.' },
        { id: 'clocks-calendars', category: 'Logical Reasoning', icon: '🕐', label: 'Clocks & Calendars Shortcuts', formula: 'Angle between clock hands = |30H - 5.5M| | Odd days in ordinary year = 1, leap year = 2', example: 'Angle at 3:00 = |30(3) - 5.5(0)| = 90 degrees.' },
        { id: 'syllogisms', category: 'Logical Reasoning', icon: '🎯', label: 'Syllogisms & Logical Deductions', formula: 'Draw minimum overlapping Venn diagrams to test if conclusion holds universally', example: 'All cats are pets. Some pets are dogs. Does NOT guarantee some cats are dogs.' },
        { id: 'direction-test', category: 'Logical Reasoning', icon: '🧭', label: 'Direction & Distance Sense', formula: 'Track North, East, South, West vectors. Final displacement = √(Δx² + Δy²)', example: 'Walk 3m North, then 4m East. Distance from start = √(9 + 16) = 5m.' },
        { id: 'number-series', category: 'Logical Reasoning', icon: '🔢', label: 'Number & Letter Series', formula: 'Check differences, double differences, ratios, squares, cubes, and prime numbers', example: 'Series: 2, 6, 12, 20, 30, ... Differences are 4, 6, 8, 10. Next difference is 12 => 42.' },
        { id: 'input-output', category: 'Logical Reasoning', icon: '⚙️', label: 'Machine Input-Output Sorting', formula: 'Identify if sorting by alphabetical order, numerical magnitude, or alternate shifts', example: 'Step 1 brings largest number to front, Step 2 brings first alphabetical word second.' },
        // Data Interpretation
        { id: 'data-tables', category: 'Data Interpretation', icon: '📋', label: 'Data Tables & Analysis', formula: 'Focus on growth percentage: [(New - Old) / Old] × 100 and quick ratios', example: 'Sales grew from 200 to 250. Growth % = (50 / 200) × 100 = 25%.' },
        { id: 'bar-charts', category: 'Data Interpretation', icon: '📊', label: 'Bar Charts & Histograms', formula: 'Compare visual height differences and calculate averages across years rapidly', example: 'If Year 1 = 40 and Year 2 = 60, average sales across both years = 50.' },
        { id: 'pie-charts', category: 'Data Interpretation', icon: '🥧', label: 'Pie Charts & Degree Breakdown', formula: 'Total circle = 360° or 100% | 1% = 3.6° | Value = (Central Angle / 360) × Total', example: 'Sector with 72° represents (72/360) × 100 = 20% of the total budget.' },
        { id: 'line-graphs', category: 'Data Interpretation', icon: '📈', label: 'Line Graphs & Trend Analysis', formula: 'Look for steep slope increases (high rate of change) and inflection points', example: 'Line rising from 10 to 40 in 1 year has a slope of +30 units/year.' },
        { id: 'data-sufficiency', category: 'Data Interpretation', icon: '❓', label: 'Data Sufficiency Rules', formula: 'Test Statement 1 alone, then Statement 2 alone, then both combined (A, B, C, D, E)', example: 'Question: Is x even? Stmt 1: 2x is even (Insufficient). Stmt 2: x+1 is odd (Sufficient). Ans: B.' }
    ];

    let pickerPage = 0;
    const ITEMS_PER_PAGE = 15;
    let selectedPickerTopic = null;

    // ---------- Mascot SVG ----------
    function getMascotSVG(mood) {
        const skin = '#e8b88a';
        const skinLight = '#f2ceaa';
        const skinShadow = '#d4976a';
        const hair = '#1a0e08';
        const hairMid = '#2e1a10';
        const hairShine = '#5a3525';
        const lip = '#d4555a';
        const lipDark = '#b8444a';
        const blouse = mood === 'sad' ? '#8090a0' : '#7c3aed';
        const blouseLight = mood === 'sad' ? '#a0b0c0' : '#a78bfa';
        const iris = '#3b2010';

        // --- Eyes ---
        let eyeLeft, eyeRight;
        if (mood === 'happy') {
            eyeLeft = `<path d="M31 35 Q34 31 37 35" stroke="${iris}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
            eyeRight = `<path d="M43 35 Q46 31 49 35" stroke="${iris}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
        } else if (mood === 'sad') {
            eyeLeft = `<ellipse cx="34" cy="34.5" rx="3.3" ry="3.8" fill="white"/><ellipse cx="34" cy="34.5" rx="2" ry="2.2" fill="${iris}"/><ellipse cx="34.7" cy="33.8" rx="0.8" ry="0.9" fill="white"/>`;
            eyeRight = `<ellipse cx="46" cy="34.5" rx="3.3" ry="3.8" fill="white"/><ellipse cx="46" cy="34.5" rx="2" ry="2.2" fill="${iris}"/><ellipse cx="46.7" cy="33.8" rx="0.8" ry="0.9" fill="white"/>`;
        } else if (mood === 'thinking') {
            eyeLeft = `<ellipse cx="34" cy="34.5" rx="3.3" ry="3.8" fill="white"/><ellipse cx="35" cy="33.5" rx="2" ry="2.2" fill="${iris}"/><ellipse cx="35.7" cy="32.8" rx="0.8" ry="0.9" fill="white"/>`;
            eyeRight = `<ellipse cx="46" cy="34.5" rx="3.3" ry="3.8" fill="white"/><ellipse cx="47" cy="33.5" rx="2" ry="2.2" fill="${iris}"/><ellipse cx="47.7" cy="32.8" rx="0.8" ry="0.9" fill="white"/>`;
        } else {
            eyeLeft = `<ellipse cx="34" cy="34.5" rx="3.3" ry="3.8" fill="white"/><ellipse cx="34" cy="34.5" rx="2" ry="2.2" fill="${iris}"/><ellipse cx="34.7" cy="33.8" rx="0.8" ry="0.9" fill="white"/>`;
            eyeRight = `<ellipse cx="46" cy="34.5" rx="3.3" ry="3.8" fill="white"/><ellipse cx="46" cy="34.5" rx="2" ry="2.2" fill="${iris}"/><ellipse cx="46.7" cy="33.8" rx="0.8" ry="0.9" fill="white"/>`;
        }

        // --- Mouth ---
        let mouth;
        if (mood === 'happy') {
            mouth = `<path d="M35 42 Q40 48 45 42" stroke="${lip}" stroke-width="2" fill="${lip}" opacity="0.9" stroke-linecap="round"/><path d="M37 42.5 Q40 44 43 42.5" stroke="white" stroke-width="1" fill="white" opacity="0.5"/>`;
        } else if (mood === 'sad') {
            mouth = `<path d="M35.5 44 Q40 41 44.5 44" stroke="${lipDark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
        } else if (mood === 'thinking') {
            mouth = `<ellipse cx="42" cy="43" rx="2.5" ry="2" fill="${lip}" opacity="0.8"/>`;
        } else {
            mouth = `<path d="M36 42 Q40 45 44 42" stroke="${lip}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
        }

        return `<svg class="mascot-svg" viewBox="0 0 80 80" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
            <!-- Hair back -->
            <ellipse cx="40" cy="26" rx="22" ry="18" fill="${hair}"/>
            <ellipse cx="40" cy="22" rx="18" ry="12" fill="${hairMid}"/>
            <path d="M22 26 Q20 38 22 48" stroke="${hair}" stroke-width="6" fill="none" stroke-linecap="round"/>
            <path d="M58 26 Q60 38 58 48" stroke="${hair}" stroke-width="6" fill="none" stroke-linecap="round"/>

            <!-- Face -->
            <ellipse cx="40" cy="38" rx="17" ry="18" fill="${skin}"/>
            <ellipse cx="40" cy="40" rx="15" ry="14" fill="${skinLight}" opacity="0.4"/>
            <ellipse cx="33" cy="40" rx="4" ry="3" fill="${skinLight}" opacity="0.35"/>
            <ellipse cx="47" cy="40" rx="4" ry="3" fill="${skinLight}" opacity="0.35"/>

            <!-- Hair front / bangs -->
            <path d="M23 28 Q28 14 40 14 Q52 14 57 28" fill="${hair}"/>
            <path d="M28 22 Q34 12 40 14" stroke="${hairShine}" stroke-width="1.5" fill="none" opacity="0.6"/>

            <!-- Eyebrows -->
            <path d="M29 30 Q34 ${mood === 'sad' ? '29' : '27'} 38 ${mood === 'sad' ? '30' : '29'}" stroke="${hair}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <path d="M42 ${mood === 'sad' ? '30' : '29'} Q46 ${mood === 'sad' ? '29' : '27'} 51 30" stroke="${hair}" stroke-width="1.8" fill="none" stroke-linecap="round"/>

            <!-- Eyes -->
            ${eyeLeft}
            ${eyeRight}

            <!-- Nose -->
            <path d="M39 38 Q40 40 41 38" stroke="${skinShadow}" stroke-width="1.2" fill="none" stroke-linecap="round"/>

            <!-- Mouth -->
            ${mouth}

            <!-- Blouse -->
            <path d="M25 55 Q26 52 40 52 Q54 52 55 55 L58 68 Q40 72 22 68 Z" fill="${blouse}"/>
            <path d="M30 55 Q40 58 50 55" stroke="${blouseLight}" stroke-width="1" fill="none" opacity="0.5"/>
            <circle cx="40" cy="58" r="1.5" fill="${blouseLight}" opacity="0.6"/>

            <!-- Earrings -->
            <circle cx="23" cy="42" r="2" fill="#ffd700" opacity="0.8"/>
            <circle cx="57" cy="42" r="2" fill="#ffd700" opacity="0.8"/>

            <!-- Nose ring -->
            <circle cx="42" cy="39.5" r="1" fill="#ffd700" opacity="0.7" stroke="#daa520" stroke-width="0.3"/>

            <!-- Hair accessories -->
            <circle cx="57" cy="52" r="1.5" fill="#ffc800"/>
            <path d="M55.5 53.5 Q57 57 58.5 53.5" stroke="#ffc800" stroke-width="1" fill="#ffd740" stroke-linecap="round"/>
            <circle cx="57" cy="57.5" r="0.8" fill="#ffc800"/>

            <!-- Bindi -->
            <circle cx="40" cy="27" r="1.3" fill="#d42020" opacity="0.9"/>
        </svg>`;
    }

    // ---------- DOM Helpers ----------
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    function setProgress(pct) {
        const bar = $('.preview-progress-bar');
        if (bar) bar.style.width = pct + '%';
    }

    function updateStats() {
        const xpEl = $('#pv-xp');
        const streakEl = $('#pv-streak');
        const heartsEl = $('#pv-hearts');
        if (xpEl) xpEl.textContent = xp;
        if (streakEl) streakEl.textContent = streak;
        if (heartsEl) heartsEl.textContent = hearts;
    }

    function showScreen(id) {
        $$('.preview-screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(id);
        if (target) target.classList.add('active');

        // Hide bottom nav on all screens except the main dashboard screens
        const nav = document.getElementById('overlay-bottom-nav');
        if (nav) {
            if (id === 'screen-dashboard') {
                nav.style.display = 'flex';
            } else {
                nav.style.display = 'none';
            }
        }
    }

    function setMascot(container, mood, text) {
        container.innerHTML = `
            <div class="mascot-wrap">
                ${getMascotSVG(mood)}
                <div class="mascot-bubble">${text}</div>
            </div>
        `;
        setTimeout(() => {
            const svg = container.querySelector('.mascot-svg');
            if (svg) { svg.classList.add('bounce'); setTimeout(() => svg.classList.remove('bounce'), 600); }
        }, 50);
    }

    function showFeedback(isCorrect, explanation, onContinue) {
        const drawer = $('#feedback-drawer');
        drawer.className = 'feedback-drawer show ' + (isCorrect ? 'correct-drawer' : 'incorrect-drawer');
        drawer.querySelector('.feedback-title').textContent = isCorrect ? '🎉 Correct!' : '😅 Not quite!';
        drawer.querySelector('.feedback-explanation').innerHTML = explanation;
        $('.preview-action-bar').classList.add('hidden');

        const btn = drawer.querySelector('.feedback-btn');
        btn.textContent = 'Continue';
        btn.onclick = () => {
            drawer.className = 'feedback-drawer';
            if (isCorrect) {
                xp += 10;
                updateStats();
                showXPPopup('+10 XP');
                setTimeout(onContinue, 800);
            } else {
                hearts = Math.max(0, hearts - 1);
                updateStats();
                onContinue();
            }
        };
    }

    /**
     * showRichFeedback — Enhanced feedback with trick/why/trap breakdown
     * and comprehension checkpoint (5 options).
     */
    function showRichFeedback(entry, isCorrect, onRoute) {
        const drawer = $('#feedback-drawer');
        drawer.className = 'feedback-drawer show ' + (isCorrect ? 'correct-drawer' : 'incorrect-drawer');
        drawer.querySelector('.feedback-title').textContent = isCorrect ? '🎉 Correct!' : '😅 Not quite!';

        // Build rich explanation
        let explanationHTML = `<strong>Trick:</strong> ${entry.trick || ''}`;
        if (entry.why) explanationHTML += `<br><br><strong>Why:</strong> ${entry.why}`;
        if (!isCorrect && entry.why_others_wrong) explanationHTML += `<br><br><strong>Why others are wrong:</strong> ${entry.why_others_wrong}`;
        if (entry.trap_type && entry.trap_explanation) explanationHTML += `<br><br><strong>🪤 Trap (${entry.trap_type}):</strong> ${entry.trap_explanation}`;

        drawer.querySelector('.feedback-explanation').innerHTML = explanationHTML;
        $('.preview-action-bar').classList.add('hidden');

        // Update stats
        if (isCorrect) {
            xp += 10;
            updateStats();
            showXPPopup('+10 XP');
        } else {
            hearts = Math.max(0, hearts - 1);
            updateStats();
        }

        // Build comprehension checkpoint buttons
        const btn = drawer.querySelector('.feedback-btn');
        btn.style.display = 'none'; // Hide default button

        // Create checkpoint container
        let checkpointDiv = drawer.querySelector('.comprehension-checkpoint');
        if (!checkpointDiv) {
            checkpointDiv = document.createElement('div');
            checkpointDiv.className = 'comprehension-checkpoint';
            drawer.appendChild(checkpointDiv);
        }

        const checkpoint = entry.post_answer_checkpoint;

        checkpointDiv.innerHTML = `
            <div style="margin-top:16px;font-size:0.85rem;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">How well did you understand?</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
                <button class="comp-btn" data-comp="understood" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(88,204,2,0.3);background:rgba(88,204,2,0.08);color:#58cc02;font-weight:600;font-size:0.88rem;cursor:pointer;">✅ Fully understood</button>
                <button class="comp-btn" data-comp="slightly_understood" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.08);color:#fbbf24;font-weight:600;font-size:0.88rem;cursor:pointer;">🤔 Got the gist, want to see more</button>
                <button class="comp-btn" data-comp="some_doubts" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(59,130,246,0.3);background:rgba(59,130,246,0.08);color:#3b82f6;font-weight:600;font-size:0.88rem;cursor:pointer;">❓ Mostly clear, one point unclear</button>
                <button class="comp-btn" data-comp="cant_apply_but_understood" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(168,85,247,0.3);background:rgba(168,85,247,0.08);color:#a855f7;font-weight:600;font-size:0.88rem;cursor:pointer;">🔧 Makes sense but can't apply it</button>
                <button class="comp-btn" data-comp="nothing_understood" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);color:#ef4444;font-weight:600;font-size:0.88rem;cursor:pointer;">😵 Didn't understand at all</button>
            </div>
        `;

        checkpointDiv.querySelectorAll('.comp-btn').forEach(cbtn => {
            cbtn.addEventListener('click', () => {
                const comp = cbtn.dataset.comp;
                drawer.className = 'feedback-drawer';
                btn.style.display = '';
                checkpointDiv.innerHTML = '';
                $('.preview-action-bar').classList.remove('hidden');

                // Update confidence with comprehension
                if (entry.pattern && ConfidenceTracker) {
                    ConfidenceTracker.update(entry.pattern, {
                        correct: isCorrect,
                        responseTimeMs: Date.now() - questionStartTime,
                        comprehension: comp
                    });
                }

                // Route based on comprehension
                onRoute(comp, isCorrect);
            });
        });
    }

    function showXPPopup(text) {
        const popup = $('#xp-popup');
        popup.querySelector('.xp-popup-value').textContent = text;
        popup.classList.add('show');
        setTimeout(() => popup.classList.remove('show'), 1200);
    }

    // ---------- Screens ----------

    function renderDashboard() {
        if (quizResults.length > 0) {
            renderPostResultsChoice();
        } else {
            renderSurvey();
        }
    }

    // ---------- Survey ----------
    function renderSurvey() {
        state = 'SURVEY';
        surveyStep = 0;
        selectedOption = null;
        showScreen('screen-quiz');
        setProgress(10);
        renderSurveyStep();
        $('.preview-action-bar').classList.remove('hidden');
        updateCheckBtn(false);
    }

    function renderSurveyStep() {
        const q = surveyQuestions[surveyStep];
        const container = document.getElementById('quiz-content');

        const mascotArea = document.createElement('div');
        setMascot(mascotArea, 'normal', q.question);

        const optList = document.createElement('div');
        optList.className = 'option-list';
        q.options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'option-card';
            let bars = '';
            for (let b = 0; b < 5; b++) {
                const h = 6 + b * 4;
                const active = b < opt.level;
                bars += `<div class="bar" style="height:${h}px;${active ? 'background:#58cc02;' : ''}"></div>`;
            }
            btn.innerHTML = `<span class="option-level">${bars}</span><span>${opt.text}</span>`;
            btn.addEventListener('click', () => {
                optList.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
                btn.classList.add('selected');
                selectedOption = i;
                updateCheckBtn(true);
            });
            optList.appendChild(btn);
        });

        container.innerHTML = '';
        container.appendChild(mascotArea);
        container.appendChild(optList);

        $('.preview-action-bar').classList.remove('hidden');
    }

    function handleSurveyCheck() {
        if (surveyStep === 0 && selectedOption !== null) {
            surveyKnowledge = surveyQuestions[0].options[selectedOption].text;
        } else if (surveyStep === 1 && selectedOption !== null) {
            surveyTarget = surveyQuestions[1].options[selectedOption].text;
            if (typeof AuthManager !== 'undefined') {
                AuthManager.updateCurrentUser({
                    surveyKnowledge: surveyKnowledge,
                    surveyTarget: surveyTarget
                });
            }
        }
        surveyStep++;
        selectedOption = null;
        if (surveyStep < surveyQuestions.length) {
            setProgress(10 + surveyStep * 10);
            renderSurveyStep();
            updateCheckBtn(false);
        } else {
            renderQuiz();
        }
    }

    // ---------- Diagnostic Quiz (Real Content Bank) ----------
    async function renderQuiz() {
        state = 'QUIZ';
        quizStep = 0;
        quizResults = [];
        selectedOption = null;

        // Retry loading engine if it wasn't ready (e.g. content-bank.json wasn't found on first try)
        if (!engineReady) {
            try {
                await ContentBank.init(typeof CONTENT_BANK_URL !== 'undefined' ? CONTENT_BANK_URL : 'content-bank.json');
                ConfidenceTracker.init();
                engineReady = true;
                console.log('[PreviewApp] Engine loaded on retry');
            } catch (e) {
                console.warn('[PreviewApp] Engine retry failed:', e);
            }
        }

        // Pull real diagnostic questions from the content bank
        if (engineReady) {
            currentQuizQuestions = ContentBank.getQuestionsForDiagnostic();
            // Shuffle to avoid always same order
            currentQuizQuestions = currentQuizQuestions.sort(() => Math.random() - 0.5);
            // Limit to max 7 questions for a diagnostic (one per live pattern)
            if (currentQuizQuestions.length > 7) currentQuizQuestions = currentQuizQuestions.slice(0, 7);
        }

        if (currentQuizQuestions.length === 0) {
            // Hard fallback: provide built-in diagnostic questions so quiz is never skipped
            console.warn('[PreviewApp] Using hardcoded fallback diagnostic questions');
            currentQuizQuestions = [
                { pattern: 'P4', question: 'What is 15% of 340?', options: ['48', '51', '54', '57'], correct_index: 1, trick: '10% is 34, 5% is 17. Total = 51.', why: 'Breaking percentages into 10% and 5% makes mental math instant.', topic_costume: 'percentages', difficulty: 1, step: 1, knot_id: null },
                { pattern: 'P2', question: 'If A:B = 2:3 and total is 500, what is A?', options: ['200', '250', '300', '150'], correct_index: 0, trick: 'A = (2/5) × 500 = 200', why: 'In ratio problems, convert to fraction of total.', topic_costume: 'ratio', difficulty: 1, step: 1, knot_id: null },
                { pattern: 'P3', question: 'A does a job in 10 days, B in 15. Together how many days?', options: ['5', '6', '8', '12'], correct_index: 1, trick: '1/10 + 1/15 = 5/30 = 1/6. Answer = 6 days.', why: 'Add individual rates, then invert for time.', topic_costume: 'time-and-work', difficulty: 2, step: 1, knot_id: null },
                { pattern: 'P5', question: 'HCF of 12 and 18 is?', options: ['2', '3', '6', '9'], correct_index: 2, trick: 'Factors of 12: {1,2,3,4,6,12}. Factors of 18: {1,2,3,6,9,18}. Common: 6.', why: 'HCF is the largest number dividing both.', topic_costume: 'hcf-and-lcm', difficulty: 1, step: 1, knot_id: null },
                { pattern: 'P7', question: 'Find CI on ₹1000 at 10% for 2 years.', options: ['₹200', '₹210', '₹220', '₹100'], correct_index: 1, trick: 'Year 1: 1000→1100. Year 2: 1100→1210. CI = 210.', why: 'CI compounds on accumulated amount, not just principal.', topic_costume: 'simple-and-compound-interest', difficulty: 2, step: 1, knot_id: null },
            ];
        }

        showScreen('screen-quiz');
        setProgress(30);
        renderQuizStep();
        $('.preview-action-bar').classList.remove('hidden');
        updateCheckBtn(false);
    }

    function renderQuizStep() {
        if (quizStep >= currentQuizQuestions.length) {
            renderGenuineCheckScreen();
            return;
        }

        const q = currentQuizQuestions[quizStep];
        const container = document.getElementById('quiz-content');
        questionStartTime = Date.now();

        const mascotArea = document.createElement('div');
        setMascot(mascotArea, 'thinking', q.question);

        const patternLabel = PATTERN_NAMES[q.pattern] || q.pattern;
        const topicLabel = (q.topic_costume || '').replace(/-/g, ' ');

        const tag = document.createElement('div');
        tag.style.cssText = 'text-align:center;margin-bottom:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;';
        tag.innerHTML = `
            <span style="padding:4px 14px;background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.2);border-radius:999px;font-size:0.75rem;font-weight:700;color:var(--accent-3);text-transform:uppercase;letter-spacing:0.08em;">${patternLabel}</span>
            <span style="padding:4px 14px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:999px;font-size:0.75rem;font-weight:700;color:#3b82f6;text-transform:capitalize;">${topicLabel}</span>
        `;

        const optList = document.createElement('div');
        optList.className = 'option-list';
        q.options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'option-card';
            btn.innerHTML = `<span style="width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;flex-shrink:0;color:var(--text-muted);">${String.fromCharCode(65+i)}</span><span>${opt}</span>`;
            btn.addEventListener('click', () => {
                optList.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
                btn.classList.add('selected');
                selectedOption = i;
                updateCheckBtn(true);
            });
            optList.appendChild(btn);
        });

        // Progress indicator
        const progressTag = document.createElement('div');
        progressTag.style.cssText = 'text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;font-weight:600;';
        progressTag.textContent = `Question ${quizStep + 1} of ${currentQuizQuestions.length}`;

        container.innerHTML = '';
        container.appendChild(progressTag);
        container.appendChild(mascotArea);
        container.appendChild(tag);
        container.appendChild(optList);

        $('.preview-action-bar').classList.remove('hidden');
    }

    function handleQuizCheck() {
        const q = currentQuizQuestions[quizStep];
        const isCorrect = selectedOption === q.correct_index;
        const responseTimeMs = Date.now() - questionStartTime;

        quizResults.push({
            pattern: q.pattern,
            correct: isCorrect,
            responseTimeMs
        });

        // Mark options
        const cards = $$('#quiz-content .option-card');
        cards.forEach((c, i) => {
            if (i === q.correct_index) c.classList.add('correct');
            else if (i === selectedOption && !isCorrect) c.classList.add('incorrect');
            c.style.pointerEvents = 'none';
        });

        // Update mascot
        const mascotArea = document.querySelector('#quiz-content .mascot-wrap');
        if (mascotArea) {
            mascotArea.querySelector('.mascot-svg').outerHTML = getMascotSVG(isCorrect ? 'happy' : 'sad');
            mascotArea.querySelector('.mascot-bubble').textContent = isCorrect ? 'Great job! 🎉' : 'Let\'s learn this one! 📖';
        }

        let explanation = '';
        if (q.trick) explanation += `<strong>Trick:</strong> ${q.trick}<br><br>`;
        if (q.why) explanation += `<strong>Why:</strong> ${q.why}`;
        
        showFeedback(isCorrect, explanation, () => {
            quizStep++;
            selectedOption = null;
            if (quizStep < currentQuizQuestions.length) {
                setProgress(30 + (quizStep / currentQuizQuestions.length) * 40);
                renderQuizStep();
                updateCheckBtn(false);
            } else {
                renderGenuineCheckScreen();
            }
        });
    }

    // ---------- Genuine Check ----------
    function renderGenuineCheckScreen() {
        state = 'GENUINE_CHECK';
        showScreen('screen-dashboard');
        setProgress(75);
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        const mascotArea = document.createElement('div');
        setMascot(mascotArea, 'thinking', "Diagnostic completed! Before we analyze your score, be honest with me — how did you answer these questions? 🤔");

        container.innerHTML = '';
        container.appendChild(mascotArea);
        container.innerHTML += `
            <div class="choice-screen-wrap">
                <div class="choice-cards-grid">
                    <div class="choice-card-option recommended" id="genuine-yes-btn">
                        <div class="choice-icon-wrap">🎯</div>
                        <div class="choice-text-wrap">
                            <span class="choice-badge-rec">Recommended</span>
                            <div class="choice-title">I answered genuinely & worked out the steps</div>
                            <div class="choice-desc">Evaluate my performance and generate my personalized Aptitude Profile right now based on my actual answers.</div>
                        </div>
                    </div>
                    <div class="choice-card-option" id="genuine-guess-btn">
                        <div class="choice-icon-wrap">🎲</div>
                        <div class="choice-text-wrap">
                            <div class="choice-title">I just guessed / clicked randomly</div>
                            <div class="choice-desc">I selected options at random or by guessing to see how the app works without calculating the steps.</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('genuine-yes-btn').addEventListener('click', () => {
            // Seed confidence tracker from diagnostic results
            if (engineReady && quizResults.length > 0) {
                ConfidenceTracker.seedFromDiagnostic(quizResults);
            }
            renderResults();
        });

        document.getElementById('genuine-guess-btn').addEventListener('click', () => {
            renderGuessJokeModal();
        });

        $('.preview-action-bar').classList.add('hidden');
    }

    function renderGuessJokeModal() {
        state = 'GUESS_JOKE';
        showScreen('screen-dashboard');
        setProgress(75);
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        const mascotArea = document.createElement('div');
        setMascot(mascotArea, 'happy', "Why did the student bring a ladder to the aptitude test? Because they heard guessing would take their score to the next level! 😄🪜");

        container.innerHTML = '';
        container.appendChild(mascotArea);
        container.innerHTML += `
            <div class="study-page-wrap" style="max-width:620px;">
                <div class="study-section-card" style="text-align:center;padding:34px 28px;">
                    <div style="font-size:3.2rem;margin-bottom:16px;">😉🎲📚</div>
                    <div class="study-section-title" style="justify-content:center;font-size:1.4rem;">Let's Find Your Real Superpower!</div>
                    <div style="font-size:1rem;color:var(--text-secondary);line-height:1.65;margin:16px 0 28px;">
                        We love your curiosity and speed! ⚡ But taking the diagnostic test <strong>genuinely</strong> is the secret to unlocking your real potential.<br><br>
                        When you work out the steps honestly, it helps us find exactly where you are weak so we can tailor your study feed, fix tricky concepts, and make you improve drastically in half the time!
                    </div>
                    <button class="results-cta" id="retake-quiz-btn" style="width:100%;font-size:1.05rem;">Take Diagnostic Test Genuinely 🚀</button>
                </div>
            </div>
        `;

        document.getElementById('retake-quiz-btn').addEventListener('click', () => {
            renderQuiz();
        });

        $('.preview-action-bar').classList.add('hidden');
    }

    // ---------- Results (Real Pattern Confidence) ----------
    function renderResults() {
        state = 'RESULTS';
        setProgress(80);
        showScreen('screen-results');
        $('.preview-action-bar').classList.add('hidden');

        // Save diagnostic completion status to user profile
        if (typeof AuthManager !== 'undefined') {
            AuthManager.updateCurrentUser({
                hasCompletedDiagnostic: true,
                quizResults: quizResults,
                confidenceStates: engineReady ? ConfidenceTracker.getAllStates() : {}
            });
        }

        const correct = quizResults.filter(r => r.correct).length;
        const total = quizResults.length;
        const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

        const container = document.getElementById('results-content');
        const mascotArea = document.createElement('div');
        const mood = pct >= 75 ? 'happy' : pct >= 50 ? 'normal' : 'sad';
        const msg = pct >= 75 ? `Amazing! You got ${correct}/${total} correct! You're already strong! 💪`
                   : pct >= 50 ? `Good effort — ${correct}/${total}! Let's sharpen those weak spots. 📚`
                   : `${correct}/${total} — No worries! That's exactly why Laqtum exists. Let's learn! 🚀`;
        setMascot(mascotArea, mood, msg);

        // Build REAL pattern confidence bars from the tracker
        let barsHTML = '';
        let weakestPattern = null;
        let weakestScore = 1;

        if (engineReady) {
            const livePatterns = ContentBank.getLivePatterns();
            const allStates = ConfidenceTracker.getAllStates();

            livePatterns.forEach(p => {
                const ps = allStates[p];
                const val = Math.round(ps.score * 100);
                const cls = val >= 70 ? 'good' : val >= 40 ? 'medium' : 'weak';
                const name = PATTERN_NAMES[p] || p;
                const icon = PATTERN_ICONS[p] || '📌';
                const levelLabel = ps.level.replace(/_/g, ' ');

                barsHTML += `
                    <div class="result-bar-item">
                        <div class="result-bar-label"><span>${icon} ${name}</span><span>${val}% · ${levelLabel}</span></div>
                        <div class="result-bar-track"><div class="result-bar-fill ${cls}" data-width="${val}"></div></div>
                    </div>`;

                if (ps.score < weakestScore) {
                    weakestScore = ps.score;
                    weakestPattern = p;
                }
            });
        }

        container.innerHTML = '';
        container.appendChild(mascotArea);
        container.innerHTML += `
            <div class="results-card">
                <div class="results-title">Your Pattern Profile</div>
                <div class="results-subtitle">Based on your diagnostic — real confidence scores per pattern</div>
                <div class="results-bars">${barsHTML}</div>
                <button class="results-cta" id="results-continue-btn">Start Learning — It's Free</button>
            </div>
        `;

        // Animate bars
        setTimeout(() => {
            container.querySelectorAll('.result-bar-fill').forEach(bar => {
                bar.style.width = bar.dataset.width + '%';
            });
        }, 300);

        document.getElementById('results-continue-btn').addEventListener('click', () => {
            renderPostResultsChoice();
        });
    }

    // ---------- Post-Results Choice (Pattern-based, not topic-based) ----------
    function renderPostResultsChoice() {
        state = 'CHOICE';
        showScreen('screen-dashboard');
        setProgress(100);
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        const currentUser = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUserSync() : null;

        container.innerHTML = `
            <div class="user-home-wrap">
                <!-- Hero Title -->
                <div class="user-home-hero">
                    <h1 class="user-home-title">Crack the <span class="highlight-violet">pattern</span>,<br>not your head</h1>
                    <div class="user-home-pill">
                        <span class="pill-dot">⚡</span>
                        <span>Aptitude Pattern Model</span>
                        <span class="pill-refresh">🔄</span>
                    </div>
                </div>

                <!-- 2 Auto-Scrolling Marquee Topic Rows (Moving Right-to-Left Automatically) -->
                <div class="horizontal-chips-wrapper">
                    <div class="marquee-track row-marquee-1">
                        <div class="marquee-content">
                            <div class="topic-chip" data-topic="percentages"><span class="chip-icon">📊</span> Percentages & Shortcuts</div>
                            <div class="topic-chip" data-topic="profit-loss"><span class="chip-icon">💰</span> Profit, Loss & Discount</div>
                            <div class="topic-chip" data-topic="time-work"><span class="chip-icon">🔧</span> Time & Work</div>
                            <div class="topic-chip" data-topic="trains"><span class="chip-icon">🚆</span> Problems on Trains</div>
                            <div class="topic-chip" data-topic="partnership"><span class="chip-icon">🤝</span> Partnership</div>
                        </div>
                        <div class="marquee-content" aria-hidden="true">
                            <div class="topic-chip" data-topic="percentages"><span class="chip-icon">📊</span> Percentages & Shortcuts</div>
                            <div class="topic-chip" data-topic="profit-loss"><span class="chip-icon">💰</span> Profit, Loss & Discount</div>
                            <div class="topic-chip" data-topic="time-work"><span class="chip-icon">🔧</span> Time & Work</div>
                            <div class="topic-chip" data-topic="trains"><span class="chip-icon">🚆</span> Problems on Trains</div>
                            <div class="topic-chip" data-topic="partnership"><span class="chip-icon">🤝</span> Partnership</div>
                        </div>
                    </div>

                    <div class="marquee-track row-marquee-2">
                        <div class="marquee-content">
                            <div class="topic-chip" data-topic="age-problems"><span class="chip-icon">🎂</span> Problems on Ages</div>
                            <div class="topic-chip" data-topic="averages"><span class="chip-icon">📈</span> Averages & Weighted Mean</div>
                            <div class="topic-chip" data-topic="ratio"><span class="chip-icon">⚖️</span> Ratio & Proportion</div>
                            <div class="topic-chip" data-topic="si-ci"><span class="chip-icon">🏦</span> Simple & Compound Interest</div>
                            <div class="topic-chip" data-topic="probability"><span class="chip-icon">🎲</span> Probability</div>
                        </div>
                        <div class="marquee-content" aria-hidden="true">
                            <div class="topic-chip" data-topic="age-problems"><span class="chip-icon">🎂</span> Problems on Ages</div>
                            <div class="topic-chip" data-topic="averages"><span class="chip-icon">📈</span> Averages & Weighted Mean</div>
                            <div class="topic-chip" data-topic="ratio"><span class="chip-icon">⚖️</span> Ratio & Proportion</div>
                            <div class="topic-chip" data-topic="si-ci"><span class="chip-icon">🏦</span> Simple & Compound Interest</div>
                            <div class="topic-chip" data-topic="probability"><span class="chip-icon">🎲</span> Probability</div>
                        </div>
                    </div>
                </div>

                <!-- Section Header -->
                <div class="user-section-header">
                    <h2>Ride the Placement Trend</h2>
                    <span class="section-filter-icon">≡</span>
                </div>

                <!-- Company Target Cards (2x2 Vertical Stacked Grid) -->
                <div class="company-cards-grid">
                    <div class="company-card" data-topic="percentages" id="card-infosys">
                        <div class="company-card-illustration-wrap bg-purple">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F5F5FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-3.05 11a22.35 22.35 0 0 1-3.95 2z"/><path d="M9 12l-5 5"/><path d="M12 9l5-5"/></svg>
                        </div>
                        <div class="company-card-content">
                            <h3>Crack Infosys & TCS</h3>
                            <p>Master high-frequency speed arithmetic and percentage shortcuts.</p>
                        </div>
                    </div>

                    <div class="company-card" data-topic="seating-linear" id="card-accenture">
                        <div class="company-card-illustration-wrap bg-pink">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F5F5FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        </div>
                        <div class="company-card-content">
                            <h3>Crack Accenture & Wipro</h3>
                            <p>Recognize pattern knots in logical reasoning & seating arrangements.</p>
                        </div>
                    </div>

                    <div class="company-card" data-topic="probability" id="card-amazon">
                        <div class="company-card-illustration-wrap bg-indigo">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F5F5FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l3 12"/><path d="M13 3l3 6-3 12"/><path d="M2 9h20"/></svg>
                        </div>
                        <div class="company-card-content">
                            <h3>Crack Amazon & Product</h3>
                            <p>Conquer probability, permutations, and speed algebra questions.</p>
                        </div>
                    </div>

                    <div class="company-card" data-topic="hcf-lcm" id="card-gate">
                        <div class="company-card-illustration-wrap bg-teal">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F5F5FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/></svg>
                        </div>
                        <div class="company-card-content">
                            <h3>Crack GATE & Aptitude</h3>
                            <p>Master modular arithmetic, prime factors, and HCF/LCM patterns.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Wire topic chips
        container.querySelectorAll('.topic-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const topicId = chip.dataset.topic;
                const found = allAptitudeTopics.find(t => t.id === topicId);
                if (found) {
                    selectedPickerTopic = found;
                    const mapping = TOPIC_MAPPING[topicId];
                    if (mapping) {
                        attemptTopicAccess(topicId, mapping);
                    }
                }
            });
        });

        // Wire company cards
        container.querySelectorAll('.company-card').forEach(card => {
            card.addEventListener('click', () => {
                const topicId = card.dataset.topic;
                const found = allAptitudeTopics.find(t => t.id === topicId);
                if (found) {
                    selectedPickerTopic = found;
                    const mapping = TOPIC_MAPPING[topicId];
                    if (mapping) {
                        attemptTopicAccess(topicId, mapping);
                    }
                }
            });
        });

        // Wire overlay bottom nav
        wireAppBottomNav('home');
        $('.preview-action-bar').classList.add('hidden');
    }

    function wireAppBottomNav(activeId) {
        const homeBtn = document.getElementById('app-nav-home');
        const topicsBtn = document.getElementById('app-nav-topics');
        const accessBtn = document.getElementById('app-nav-access');

        const nav = document.getElementById('overlay-bottom-nav');
        if (nav && activeId) {
            nav.querySelectorAll('.app-bottom-nav-item').forEach(item => item.classList.remove('active'));
            const activeItem = document.getElementById(`app-nav-${activeId}`);
            if (activeItem) activeItem.classList.add('active');
        }

        if (homeBtn && !homeBtn.dataset.wired) {
            homeBtn.dataset.wired = 'true';
            homeBtn.addEventListener('click', () => {
                renderPostResultsChoice();
            });
        }
        if (topicsBtn && !topicsBtn.dataset.wired) {
            topicsBtn.dataset.wired = 'true';
            topicsBtn.addEventListener('click', () => {
                pickerPage = 0;
                selectedPickerTopic = null;
                renderTopicPickerPage();
            });
        }
        if (accessBtn && !accessBtn.dataset.wired) {
            accessBtn.dataset.wired = 'true';
            accessBtn.addEventListener('click', () => {
                renderAccessPage();
            });
        }
    }

    function renderAccessPage() {
        state = 'ACCESS';
        showScreen('screen-dashboard');
        setProgress(100);
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        const currentUser = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUserSync() : null;
        const userName = currentUser ? currentUser.name : 'Aptitude Student';
        const userEmail = currentUser ? currentUser.email : 'Student Account';
        const targetExam = currentUser && currentUser.targetExam ? currentUser.targetExam : 'IT & Product Companies';
        const aptitudeLevel = currentUser && currentUser.aptitudeLevel ? currentUser.aptitudeLevel : 'Intermediate';

        container.innerHTML = `
            <div class="user-home-wrap" style="text-align:center;">
                <div class="user-home-hero" style="margin-bottom:28px;">
                    <div style="width:72px;height:72px;border-radius:50%;background:rgba(139,92,246,0.15);border:2px solid #8B5CF6;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 14px;box-shadow:0 0 24px rgba(139,92,246,0.35);">
                        👤
                    </div>
                    <h2 style="font-size:1.6rem;font-weight:800;color:#F5F5FA;margin:0 0 4px 0;">${userName}</h2>
                    <div style="font-size:0.85rem;color:#9E9EB0;">${userEmail}</div>
                </div>

                <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:28px;">
                    <div class="company-card" style="padding:18px;">
                        <div style="font-size:0.75rem;font-weight:700;color:#8B5CF6;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Main Target Goal</div>
                        <div style="font-size:1.1rem;font-weight:800;color:#F5F5FA;">🎯 ${targetExam}</div>
                    </div>

                    <div class="company-card" style="padding:18px;">
                        <div style="font-size:0.75rem;font-weight:700;color:#FF5C7A;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Aptitude Knowledge Level</div>
                        <div style="font-size:1.1rem;font-weight:800;color:#F5F5FA;">⚡ ${aptitudeLevel}</div>
                    </div>

                    <div class="company-card" style="padding:18px;">
                        <div style="font-size:0.75rem;font-weight:700;color:#38BDF8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Access Engine</div>
                        <div style="font-size:1.1rem;font-weight:800;color:#F5F5FA;">💎 LaquTum Full Pattern Engine Access</div>
                    </div>
                </div>

                <button id="access-logout-btn" style="width:100%;padding:14px;background:rgba(255,92,122,0.15);border:1px solid rgba(255,92,122,0.4);color:#FF5C7A;border-radius:16px;font-weight:800;cursor:pointer;transition:all 0.2s ease;">
                    Sign Out / Switch Account
                </button>
            </div>
        `;

        const logoutBtn = document.getElementById('access-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (typeof AuthManager !== 'undefined') {
                    AuthManager.logOut();
                    location.reload();
                }
            });
        }

        wireAppBottomNav('access');
        $('.preview-action-bar').classList.add('hidden');
    }

    // ---------- Pattern Picker (replaces old topic picker) ----------
    function renderPatternPicker() {
        state = 'PICKER';
        showScreen('screen-dashboard');
        setProgress(88);
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        const livePatterns = engineReady ? ContentBank.getLivePatterns() : [];
        const allStates = engineReady ? ConfidenceTracker.getAllStates() : {};

        let cardsHTML = '';
        livePatterns.forEach(p => {
            const ps = allStates[p] || { score: 0, level: 'NOT_RECOGNIZED' };
            const name = PATTERN_NAMES[p] || p;
            const icon = PATTERN_ICONS[p] || '📌';
            const questions = engineReady ? ContentBank.getQuestions(p).length : 0;
            const levelLabel = ps.level.replace(/_/g, ' ');
            const val = Math.round(ps.score * 100);
            const levelColor = ps.level === 'MASTERED' ? '#10b981' : ps.level === 'SOLID' ? '#3b82f6' : ps.level === 'EMERGING' ? '#f59e0b' : '#ef4444';

            cardsHTML += `
                <div class="picker-pill pattern-picker-card" data-pattern="${p}" style="display:flex;flex-direction:column;gap:8px;padding:16px;text-align:left;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:1.5rem;">${icon}</span>
                        <div>
                            <div style="font-weight:700;font-size:0.95rem;color:#fff;">${name}</div>
                            <div style="font-size:0.75rem;color:var(--text-muted);">${questions} questions</div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div style="flex:1;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
                            <div style="height:100%;width:${val}%;background:${levelColor};border-radius:3px;"></div>
                        </div>
                        <span style="font-size:0.7rem;font-weight:700;color:${levelColor};text-transform:uppercase;">${levelLabel}</span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="topic-picker-wrap">
                <div class="topic-picker-card">
                    <div class="picker-top-bar">
                        <button class="picker-back-btn" id="picker-back" title="Go back">←</button>
                    </div>
                    <div class="picker-title">Choose a Pattern to Master</div>
                    <div class="picker-pills-grid" id="picker-pills-grid" style="display:flex;flex-direction:column;gap:10px;">
                        ${cardsHTML}
                    </div>
                </div>
            </div>
        `;

        document.getElementById('picker-back').addEventListener('click', () => {
            renderPostResultsChoice();
        });

        container.querySelectorAll('.pattern-picker-card').forEach(card => {
            card.addEventListener('click', () => {
                const pattern = card.dataset.pattern;
                startPatternFlow(pattern);
            });
        });

        $('.preview-action-bar').classList.add('hidden');
    }

    // ---------- Full Topic Picker (Original 4-page UI) ----------
    function renderTopicPickerPage() {
        state = 'PICKER';
        showScreen('screen-dashboard');
        setProgress(88);
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        const totalPages = Math.ceil(allAptitudeTopics.length / ITEMS_PER_PAGE);
        const startIndex = pickerPage * ITEMS_PER_PAGE;
        const pageItems = allAptitudeTopics.slice(startIndex, startIndex + ITEMS_PER_PAGE);

        let pillsHTML = '';
        pageItems.forEach((t) => {
            const isSel = (selectedPickerTopic && selectedPickerTopic.id === t.id);
            pillsHTML += `<div class="picker-pill ${isSel ? 'active' : ''}" data-id="${t.id}">${t.icon} ${t.label}</div>`;
        });

        container.innerHTML = `
            <div class="topic-picker-wrap">
                <div class="topic-picker-card">
                    <div class="picker-top-bar">
                        <button class="picker-back-btn" id="picker-back" title="Go back">←</button>
                    </div>
                    <div class="picker-title">Where would you like to start from</div>
                    
                    <div class="picker-pills-grid" id="picker-pills-grid">
                        ${pillsHTML}
                    </div>

                    <div class="picker-pagination-bar">
                        <button class="picker-page-btn" id="picker-prev" ${pickerPage === 0 ? 'disabled' : ''}>← Previous Page</button>
                        <span class="picker-page-indicator">Page ${pickerPage + 1} of ${totalPages}</span>
                        <button class="picker-page-btn" id="picker-next" ${pickerPage >= totalPages - 1 ? 'disabled' : ''}>Next Page →</button>
                    </div>

                    <button class="picker-continue-btn ${selectedPickerTopic ? 'enabled' : ''}" id="picker-continue" ${selectedPickerTopic ? '' : 'disabled'}>Continue</button>
                </div>
            </div>
        `;

        // Back button
        document.getElementById('picker-back').addEventListener('click', () => {
            renderPostResultsChoice();
        });

        // Pill click (single selection only)
        container.querySelectorAll('.picker-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const tid = pill.dataset.id;
                selectedPickerTopic = allAptitudeTopics.find(x => x.id === tid);
                
                // Update UI state cleanly without full re-render
                container.querySelectorAll('.picker-pill').forEach(p => {
                    p.classList.toggle('active', p.dataset.id === tid);
                });

                const continueBtn = document.getElementById('picker-continue');
                if (continueBtn) {
                    continueBtn.classList.add('enabled');
                    continueBtn.disabled = false;
                }
            });
        });

        // Pagination buttons
        document.getElementById('picker-prev').addEventListener('click', () => {
            if (pickerPage > 0) {
                pickerPage--;
                renderTopicPickerPage();
            }
        });

        document.getElementById('picker-next').addEventListener('click', () => {
            if (pickerPage < totalPages - 1) {
                pickerPage++;
                renderTopicPickerPage();
            }
        });

        // Continue button
        document.getElementById('picker-continue').addEventListener('click', async () => {
            if (selectedPickerTopic) {
                const mapping = TOPIC_MAPPING[selectedPickerTopic.id];
                const mappedPattern = mapping ? mapping.pattern : null;
                const costumes = mapping ? mapping.costumes : [];

                // Retry loading engine if it wasn't ready
                if (!engineReady) {
                    try {
                        await ContentBank.init(typeof CONTENT_BANK_URL !== 'undefined' ? CONTENT_BANK_URL : 'content-bank.json');
                        ConfidenceTracker.init();
                        engineReady = true;
                        console.log('[PreviewApp] Engine loaded on topic-picker retry');
                    } catch (e) {
                        console.warn('[PreviewApp] Engine retry failed on topic picker:', e);
                    }
                }

                if (mappedPattern && engineReady && ContentBank.hasCostumeContent(costumes)) {
                    // We have JSON content for this specific topic
                    attemptTopicAccess(selectedPickerTopic.id, mapping);
                } else {
                    // Fallback to static study flow for topics without JSON yet
                    renderSharpenAxeQuoteScreen(selectedPickerTopic);
                }
            }
        });

        wireAppBottomNav('topics');
        $('.preview-action-bar').classList.add('hidden');
    }

    function renderSharpenAxeQuoteScreen(topic) {
        state = 'QUOTE_TRANSITION';
        showScreen('screen-dashboard');
        setProgress(92);
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        const mascotArea = document.createElement('div');
        setMascot(mascotArea, 'happy', `Before we tackle ${topic.label}, remember the golden rule of preparation! 🪓✨`);

        container.innerHTML = '';
        container.appendChild(mascotArea);
        container.innerHTML += `
            <div class="study-page-wrap" style="max-width:680px;text-align:center;padding:20px 14px 60px;">
                <div class="study-section-card" style="padding:42px 36px;background:#18181b;border:2px solid rgba(168,85,247,0.35);box-shadow:0 24px 64px rgba(0,0,0,0.65), 0 0 30px rgba(124,58,237,0.2);position:relative;overflow:hidden;">
                    <div style="position:absolute;top:-60px;right:-60px;width:160px;height:160px;background:var(--accent-gradient-vibrant);filter:blur(65px);opacity:0.35;pointer-events:none;"></div>
                    
                    <div style="font-size:3.5rem;margin-bottom:18px;animation:rootPulse 2.5s infinite;">🪓✨🌳</div>
                    
                    <div style="font-size:1.95rem;font-weight:900;color:#ffffff;line-height:1.4;letter-spacing:-0.02em;text-shadow:0 2px 16px rgba(0,0,0,0.5);margin:0 auto 16px;max-width:580px;">
                        "Give me six hours to chop down a tree and I will spend the first four sharpening the axe."
                    </div>
                    
                    <div style="font-size:1.18rem;font-weight:700;color:var(--accent-3);font-style:italic;margin-bottom:28px;">
                        — Abraham Lincoln
                    </div>
                    
                    <div style="font-size:0.98rem;color:var(--text-secondary);line-height:1.68;margin:0 auto 32px;max-width:560px;background:rgba(255,255,255,0.035);padding:20px 24px;border-radius:14px;border:1px solid rgba(255,255,255,0.08);text-align:left;">
                        <div style="margin-bottom:12px;text-align:center;">You chose to master <strong style="color:#fff;font-size:1.06rem;">${topic.icon} ${topic.label}</strong>.</div>
                        <div style="color:var(--text-primary);">
                            <strong style="color:var(--accent-3);">Aptitude is truly about mastering the mathematics and the subtle nuances of math.</strong> Just as chopping down a massive tree requires a razor-sharp blade, conquering competitive aptitude requires understanding the deeper mathematical logic, underlying formulas, and problem-solving nuances.<br><br>
                            Instead of rushing straight into complex calculations, let's spend the next few moments <strong>sharpening your mental axe</strong> so every calculation becomes effortless and precise!
                        </div>
                    </div>

                    <button class="results-cta" id="start-sharpened-study-btn" style="width:100%;font-size:1.1rem;padding:16px;box-shadow:0 8px 28px rgba(124,58,237,0.5);">
                        Begin Training — Sharpen My Axe 🚀
                    </button>
                </div>
            </div>
        `;

        document.getElementById('start-sharpened-study-btn').addEventListener('click', () => {
            renderAptitudeSignificanceScreen(topic);
        });

        wireAppBottomNav('topics');
        $('.preview-action-bar').classList.add('hidden');
    }

    let significanceStep = 0;

    function renderAptitudeSignificanceScreen(topic, step = 0) {
        state = 'APTITUDE_SIGNIFICANCE';
        significanceStep = step;
        showScreen('screen-dashboard');
        setProgress(93 + step * 1.5);
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        const significanceLines = [
            {
                icon: '🧠',
                title: '1. What is Aptitude?',
                body: "Aptitude isn't about rote memorization of textbook theories — it is your brain's natural agility to recognize hidden patterns, process information logically, and make razor-sharp decisions under tight time limits.",
                bubble: "Let's start from the foundation! What exactly is Aptitude and why is it tested? 💡"
            },
            {
                icon: '📐',
                title: '2. The Significance of Mathematics',
                body: "Mathematics is the core language and engine of aptitude. By mastering foundational mathematical logic and subtle numerical nuances, you transform complex, intimidating word problems into clean, simple arithmetic relationships.",
                bubble: "Now, what makes mathematics the absolute secret weapon in aptitude? Let's uncover it! 📐✨"
            },
            {
                icon: '⚡',
                title: '3. How Math Makes Solving Fast & Easy',
                body: "When you understand the mathematical why and its nuances, you unlock powerful shortcuts, mental estimation tricks, and option elimination methods — letting you solve 3-minute multi-step problems effortlessly in under 15 seconds!",
                bubble: "Here is where the magic happens! How does deep mathematical intuition make solving lightning fast? ⚡"
            },
            {
                icon: '🏆',
                title: '4. How You Stand Out From the Crowd',
                body: "While 95% of candidates get bogged down by tedious algebra and run out of time, your mathematical intuition gives you lightning-fast speed and pinpoint accuracy — placing your scores at the very top of competitive cutoffs!",
                bubble: "And finally, here is how this mastery gives you an unfair advantage over every other candidate! 🏆✨"
            }
        ];

        const currentLine = significanceLines[step];

        const mascotArea = document.createElement('div');
        setMascot(mascotArea, 'happy', currentLine.bubble);

        let barsHTML = '';
        for (let i = 0; i < significanceLines.length; i++) {
            const isActive = i === step;
            const isDone = i < step;
            barsHTML += `<div style="flex:1;height:6px;border-radius:4px;background:${isActive ? 'var(--accent-gradient-vibrant)' : isDone ? '#a855f7' : 'rgba(255,255,255,0.1)'};box-shadow:${isActive ? '0 0 10px rgba(168,85,247,0.8)' : 'none'};"></div>`;
        }

        let historyHTML = '';
        if (step > 0) {
            historyHTML += `<div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;opacity:0.65;">`;
            for (let i = 0; i < step; i++) {
                const prev = significanceLines[i];
                historyHTML += `
                    <div style="display:flex;gap:12px;align-items:center;background:rgba(255,255,255,0.02);padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);text-align:left;">
                        <span style="font-size:1.3rem;">${prev.icon}</span>
                        <span style="font-size:0.95rem;font-weight:700;color:var(--text-secondary);">${prev.title}</span>
                        <span style="margin-left:auto;color:#a855f7;font-weight:800;font-size:0.85rem;">✓ Understood</span>
                    </div>
                `;
            }
            historyHTML += `</div>`;
        }

        container.innerHTML = '';
        container.appendChild(mascotArea);
        container.innerHTML += `
            <div class="study-page-wrap" style="max-width:700px;margin:0 auto;padding:16px 14px 60px;">
                <div class="study-section-card" style="padding:36px 32px;background:#18181b;border:2px solid rgba(168,85,247,0.35);box-shadow:0 24px 64px rgba(0,0,0,0.65);">
                    
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                        <span style="font-size:0.85rem;font-weight:800;color:var(--accent-3);text-transform:uppercase;letter-spacing:0.08em;">Aptitude & Mathematics Mastery</span>
                        <span style="font-size:0.88rem;font-weight:700;color:var(--text-muted);">Line ${step + 1} of ${significanceLines.length}</span>
                    </div>
                    <div style="display:flex;gap:8px;margin-bottom:26px;">
                        ${barsHTML}
                    </div>

                    ${historyHTML}

                    <div style="background:rgba(168,85,247,0.14);padding:30px 26px;border-radius:18px;border:2px solid rgba(168,85,247,0.55);box-shadow:0 16px 48px rgba(168,85,247,0.2);text-align:left;animation:fadeIn 0.4s ease;">
                        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
                            <span style="font-size:2.4rem;background:rgba(168,85,247,0.22);width:54px;height:54px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${currentLine.icon}</span>
                            <span style="font-size:1.35rem;font-weight:900;color:#fff;line-height:1.3;">${currentLine.title}</span>
                        </div>
                        <div style="font-size:1.08rem;color:var(--text-primary);line-height:1.75;font-weight:500;">
                            ${currentLine.body}
                        </div>
                    </div>

                    <button class="picker-continue-btn" id="significance-understood-btn" disabled style="margin-top:28px;width:100%;font-size:1.1rem;padding:16px;opacity:0.45;cursor:not-allowed;box-shadow:none;">
                        ${step < significanceLines.length - 1 ? 'Next Line (Enables in 9s...)' : 'Start Studying (Enables in 9s...)'}
                    </button>
                </div>
            </div>
        `;

        let secondsLeft = 9;
        const btn = document.getElementById('significance-understood-btn');
        if (window.aptSignificanceTimer) clearInterval(window.aptSignificanceTimer);
        
        window.aptSignificanceTimer = setInterval(() => {
            secondsLeft--;
            if (secondsLeft > 0) {
                if (btn) btn.textContent = step < significanceLines.length - 1 ? `Next Line (Enables in ${secondsLeft}s...)` : `Start Studying (Enables in ${secondsLeft}s...)`;
            } else {
                clearInterval(window.aptSignificanceTimer);
                if (btn) {
                    btn.disabled = false;
                    btn.classList.add('enabled');
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                    btn.style.boxShadow = '0 8px 28px rgba(168,85,247,0.5)';
                    btn.textContent = step < significanceLines.length - 1 ? 'I Understood — Next Line →' : 'I Understood — Let\'s Start Studying! 🚀';
                }
            }
        }, 1000);

        document.getElementById('significance-understood-btn').addEventListener('click', () => {
            if (window.aptSignificanceTimer) clearInterval(window.aptSignificanceTimer);
            if (step < significanceLines.length - 1) {
                renderAptitudeSignificanceScreen(topic, step + 1);
            } else {
                renderTopicStudyPage(topic);
            }
        });

        $('.preview-action-bar').classList.add('hidden');
    }

    function renderTopicStudyPage(topic) {
        state = 'STUDY';
        showScreen('screen-dashboard');
        setProgress(95);
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        const mascotArea = document.createElement('div');
        setMascot(mascotArea, 'happy', `Let's master ${topic.label} together! Here is your core formula and step-by-step example. 📚`);

        container.innerHTML = '';
        container.appendChild(mascotArea);
        container.innerHTML += `
            <div class="study-page-wrap">
                <div class="study-section-card">
                    <div class="study-section-title">${topic.icon} ${topic.label} — Core Concept & Shortcut</div>
                    <div style="font-size:0.95rem;color:var(--text-secondary);line-height:1.6;margin-bottom:12px;">
                        Mastering this topic requires understanding the underlying relation between variables and using mental math shortcuts to save crucial seconds during exams.
                    </div>
                    <div class="study-formula-box">
                        📌 <strong>Formula / Shortcut:</strong><br>${topic.formula}
                    </div>
                    <div class="study-section-title" style="margin-top:24px;">💡 Solved Example</div>
                    <div class="study-example-box">
                        ${topic.example}
                    </div>
                    <button class="results-cta" id="study-complete-btn" style="margin-top:24px;">Mark Concept as Mastered (+25 XP) 🏆</button>
                </div>
            </div>
        `;

        document.getElementById('study-complete-btn').addEventListener('click', () => {
            xp += 25;
            updateStats();
            showXPPopup('+25 XP');
            const mascotW = container.querySelector('.mascot-wrap');
            if (mascotW) {
                mascotW.querySelector('.mascot-svg').outerHTML = getMascotSVG('happy');
                mascotW.querySelector('.mascot-bubble').textContent = `Awesome job! You earned 25 XP mastering ${topic.label}! 🎉`;
            }
            const btn = document.getElementById('study-complete-btn');
            btn.textContent = 'Explore More Concepts →';
            btn.style.background = 'linear-gradient(135deg, #58cc02, #46a302)';
            btn.onclick = () => {
                pickerPage = 0;
                selectedPickerTopic = null;
                renderTopicPickerPage();
            };
        });

        $('.preview-action-bar').classList.add('hidden');
    }

    // ---------- Paywall Logic ----------
    async function attemptTopicAccess(topicId, mapping) {
        if (!mapping) return;
        const currentUser = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUserSync() : null;
        
        if (!currentUser) {
            alert("Please log in to start learning.");
            return;
        }

        let unlocked = currentUser.unlockedTopics || [];
        
        // If already unlocked or Admin, proceed immediately
        if (unlocked.includes(topicId) || currentUser.isAdmin) {
            startPatternFlow(mapping.pattern, mapping.costumes);
            return;
        }

        // Check slots
        if (unlocked.length < 2) {
            if (confirm(`Unlock "${topicId}" as one of your 2 free topics?`)) {
                unlocked.push(topicId);
                await AuthManager.updateCurrentUser({ unlockedTopics: unlocked });
                startPatternFlow(mapping.pattern, mapping.costumes);
            }
        } else {
            showPaywall();
        }
    }

    function showPaywall() {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
        overlay.style.backdropFilter = 'blur(5px)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '9999';

        overlay.innerHTML = `
            <div style="background:#14141E; border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:32px; max-width:400px; text-align:center; color:white; font-family:sans-serif;">
                <h3 style="margin-bottom:16px; font-size:1.5rem; color:#8B5CF6;">🚀 Premium Access</h3>
                <p style="margin-bottom:16px; font-size:1.1rem; line-height:1.5;">You have reached your limit of <strong>2 free topics</strong>.</p>
                <p style="color:#94A3B8; margin-bottom:24px; font-size:0.95rem; line-height:1.5;">Upgrade to Premium to unlock all topics, view detailed analytics, and master your placements with LaquTum.</p>
                <button id="paywall-upgrade-btn" style="width:100%; padding:14px; background:#8B5CF6; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1rem; margin-bottom:12px;">Upgrade Now</button>
                <button id="paywall-close-btn" style="width:100%; padding:14px; background:transparent; color:#94A3B8; border:1px solid rgba(255,255,255,0.1); border-radius:8px; font-weight:bold; cursor:pointer; font-size:1rem;">Maybe Later</button>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('paywall-upgrade-btn').onclick = () => {
            alert('Payment Gateway Integration Pending!');
        };
        document.getElementById('paywall-close-btn').onclick = () => overlay.remove();
    }

    // ---------- Pattern Teaching Flow (Six-Step Unit) ----------
    function startPatternFlow(pattern, costumes) {
        currentPatternFlow = pattern;
        const reentryStep = engineReady ? ConfidenceTracker.getReentryStep(pattern) : 1;

        // Get questions filtered by costume (topic-specific) or by pattern (fallback)
        let allQuestions;
        if (costumes && costumes.length > 0 && engineReady) {
            allQuestions = ContentBank.getQuestionsByCostumes(costumes);
        } else {
            allQuestions = engineReady ? ContentBank.getQuestions(pattern) : [];
        }
        currentFlowEntries = allQuestions.sort((a, b) => {
            if (a.step !== b.step) return a.step - b.step;
            return (a.difficulty || 1) - (b.difficulty || 1);
        });

        // Check for saved user topic progress
        const currentUser = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUserSync() : null;
        const topicId = selectedPickerTopic ? selectedPickerTopic.id : null;
        let savedIndex = -1;
        if (currentUser && currentUser.topicProgress && topicId && currentUser.topicProgress[topicId]) {
            const tp = currentUser.topicProgress[topicId];
            if (typeof tp.flowIndex === 'number' && tp.flowIndex < currentFlowEntries.length && !tp.completed) {
                savedIndex = tp.flowIndex;
            }
        }

        if (savedIndex >= 0) {
            currentFlowIndex = savedIndex;
        } else {
            // Find starting index based on reentry step
            currentFlowIndex = 0;
            for (let i = 0; i < currentFlowEntries.length; i++) {
                if (currentFlowEntries[i].step >= reentryStep) {
                    currentFlowIndex = i;
                    break;
                }
            }
        }

        if (currentFlowEntries.length === 0) {
            renderNoContentScreen(pattern);
            return;
        }

        // Check if there's an explanation to show first
        const firstEntry = currentFlowEntries[currentFlowIndex];
        if (firstEntry.explanation_id && engineReady) {
            const explanation = ContentBank.getById(firstEntry.explanation_id);
            if (explanation && explanation.type === 'explanation') {
                renderExplanation(explanation, firstEntry);
                return;
            }
        }

        renderPatternQuestion(currentFlowIndex);
    }

    function renderNoContentScreen(pattern) {
        state = 'STUDY';
        showScreen('screen-dashboard');
        const container = document.getElementById('dashboard-content');
        const name = PATTERN_NAMES[pattern] || pattern;
        const mascotArea = document.createElement('div');
        setMascot(mascotArea, 'thinking', `Content for ${name} is being prepared! Check back soon. 📝`);
        container.innerHTML = '';
        container.appendChild(mascotArea);
        container.innerHTML += `
            <div class="study-page-wrap">
                <div class="study-section-card" style="text-align:center;padding:34px;">
                    <div style="font-size:3rem;margin-bottom:16px;">🚧</div>
                    <div style="font-size:1.2rem;font-weight:700;color:#fff;margin-bottom:12px;">Content Coming Soon</div>
                    <div style="color:var(--text-secondary);margin-bottom:24px;">We're building the teaching content for ${name}. It will be available in the next update!</div>
                    <button class="results-cta" id="back-from-empty">← Choose Another Pattern</button>
                </div>
            </div>
        `;
        document.getElementById('back-from-empty').addEventListener('click', () => renderPatternPicker());
        $('.preview-action-bar').classList.add('hidden');
    }

    function renderExplanation(explanation, nextQuestion) {
        state = 'LESSON';
        showScreen('screen-lesson');
        setProgress(90);
        const container = document.getElementById('lesson-content');

        const patternName = PATTERN_NAMES[explanation.pattern] || explanation.pattern;
        const icon = PATTERN_ICONS[explanation.pattern] || '📌';

        const mascotArea = document.createElement('div');
        setMascot(mascotArea, 'normal', `Let me teach you the ${patternName} pattern! Pay attention to this explanation. 📖`);

        container.innerHTML = '';
        container.appendChild(mascotArea);
        container.innerHTML += `
            <div class="lesson-card">
                <span class="lesson-step-tag">${icon} ${patternName} — Explanation</span>
                <h3 class="lesson-title">${explanation.knot_id ? 'Knot: ' + (explanation.knot_id || '').replace(/-/g, ' ') : 'Core Concept'}</h3>
                <div class="lesson-body" style="white-space:pre-wrap;line-height:1.8;">${explanation.content}</div>
                <div style="margin-top:20px;font-size:0.85rem;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">How well did you understand?</div>
                <div style="display:flex;flex-direction:column;gap:8px;" id="explanation-checkpoint">
                    <button class="comp-btn" data-comp="understood" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(88,204,2,0.3);background:rgba(88,204,2,0.08);color:#58cc02;font-weight:600;font-size:0.88rem;cursor:pointer;">✅ Fully understood — show me a question</button>
                    <button class="comp-btn" data-comp="slightly_understood" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.08);color:#fbbf24;font-weight:600;font-size:0.88rem;cursor:pointer;">🤔 Got the gist, want to see more</button>
                    <button class="comp-btn" data-comp="some_doubts" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(59,130,246,0.3);background:rgba(59,130,246,0.08);color:#3b82f6;font-weight:600;font-size:0.88rem;cursor:pointer;">❓ Mostly clear, one point unclear</button>
                    <button class="comp-btn" data-comp="cant_apply_but_understood" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(168,85,247,0.3);background:rgba(168,85,247,0.08);color:#a855f7;font-weight:600;font-size:0.88rem;cursor:pointer;">🔧 Makes sense but can't apply it</button>
                    <button class="comp-btn" data-comp="nothing_understood" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);color:#ef4444;font-weight:600;font-size:0.88rem;cursor:pointer;">😵 Didn't understand at all</button>
                </div>
            </div>
        `;

        document.querySelectorAll('#explanation-checkpoint .comp-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const comp = btn.dataset.comp;
                const checkpoint = explanation.checkpoint_options;

                if (checkpoint && checkpoint[comp]) {
                    const nextId = checkpoint[comp].next;
                    const resolved = engineReady ? ContentBank.resolveNext(nextId) : null;

                    if (resolved === 'CONTINUE' || resolved === null) {
                        // Go to the question this explanation prepares for
                        if (nextQuestion) {
                            renderPatternQuestion(currentFlowIndex);
                        } else {
                            advanceFlow();
                        }
                    } else if (resolved.type === 'question') {
                        renderSingleQuestion(resolved);
                    } else if (resolved.type === 'explanation') {
                        renderExplanation(resolved, nextQuestion);
                    } else if (resolved.type === 'clarification') {
                        renderClarification(resolved, explanation);
                    } else if (resolved.type === 'guided_walkthrough') {
                        renderGuidedWalkthrough(resolved);
                    } else if (resolved.type === 'escalation') {
                        renderEscalation(resolved);
                    }
                } else {
                    // No checkpoint routing — just go to the question
                    renderPatternQuestion(currentFlowIndex);
                }
            });
        });

        $('.preview-action-bar').classList.add('hidden');
    }

    function renderClarification(clarification, parentExplanation) {
        state = 'LESSON';
        showScreen('screen-lesson');
        const container = document.getElementById('lesson-content');

        const mascotArea = document.createElement('div');
        setMascot(mascotArea, 'normal', `Let me clarify that specific point for you! 💡`);

        container.innerHTML = '';
        container.appendChild(mascotArea);
        container.innerHTML += `
            <div class="lesson-card">
                <span class="lesson-step-tag">💡 Clarification</span>
                <h3 class="lesson-title">${clarification.addresses || 'Quick Clarification'}</h3>
                <div class="lesson-body" style="white-space:pre-wrap;line-height:1.8;">${clarification.content}</div>
                <button class="lesson-next-btn" id="clarification-back">Got it — go back ✓</button>
            </div>
        `;

        document.getElementById('clarification-back').addEventListener('click', () => {
            if (clarification.return_to && engineReady) {
                const returnEntry = ContentBank.getById(clarification.return_to);
                if (returnEntry && returnEntry.type === 'explanation') {
                    renderExplanation(returnEntry, currentFlowEntries[currentFlowIndex]);
                    return;
                }
            }
            // Fallback: go to current question
            renderPatternQuestion(currentFlowIndex);
        });
    }

    function renderGuidedWalkthrough(walkthrough) {
        state = 'LESSON';
        showScreen('screen-lesson');
        const container = document.getElementById('lesson-content');

        let currentWTStep = 0;

        function renderWTStep() {
            const step = walkthrough.steps[currentWTStep];
            const mascotArea = document.createElement('div');
            setMascot(mascotArea, 'thinking', `Step ${currentWTStep + 1}: Let's work through this together! 🔧`);

            container.innerHTML = '';
            container.appendChild(mascotArea);
            container.innerHTML += `
                <div class="lesson-card">
                    <span class="lesson-step-tag">🔧 Guided Walkthrough — Step ${currentWTStep + 1} of ${walkthrough.steps.length}</span>
                    <h3 class="lesson-title">${step.prompt}</h3>
                    <div class="lesson-body" style="display:none;white-space:pre-wrap;line-height:1.8;" id="wt-reveal">${step.reveal}</div>
                    <button class="lesson-next-btn" id="wt-show-reveal" style="background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);color:#a855f7;">🔍 Reveal the answer</button>
                    <button class="lesson-next-btn" id="wt-next" style="display:none;">Continue →</button>
                </div>
            `;

            document.getElementById('wt-show-reveal').addEventListener('click', () => {
                document.getElementById('wt-reveal').style.display = 'block';
                document.getElementById('wt-show-reveal').style.display = 'none';
                document.getElementById('wt-next').style.display = 'block';
            });

            document.getElementById('wt-next').addEventListener('click', () => {
                currentWTStep++;
                if (currentWTStep < walkthrough.steps.length) {
                    renderWTStep();
                } else {
                    // Walkthrough done — go to the target question
                    if (walkthrough.then && engineReady) {
                        const targetQ = ContentBank.getById(walkthrough.then);
                        if (targetQ && targetQ.type === 'question') {
                            renderSingleQuestion(targetQ);
                            return;
                        }
                    }
                    advanceFlow();
                }
            });
        }

        renderWTStep();
    }

    function renderEscalation(escalation) {
        state = 'LESSON';
        showScreen('screen-lesson');
        const container = document.getElementById('lesson-content');

        const mascotArea = document.createElement('div');
        setMascot(mascotArea, 'normal', `It's totally okay — let me try explaining this differently! 🌟`);

        container.innerHTML = '';
        container.appendChild(mascotArea);
        container.innerHTML += `
            <div class="lesson-card">
                <span class="lesson-step-tag">🌟 Let's Try a Different Angle</span>
                <div class="lesson-body" style="white-space:pre-wrap;line-height:1.8;">${escalation.content}</div>
                <button class="lesson-next-btn" id="escalation-continue">Continue learning →</button>
            </div>
        `;

        document.getElementById('escalation-continue').addEventListener('click', () => {
            advanceFlow();
        });
    }

    function renderPatternQuestion(index) {
        if (index >= currentFlowEntries.length) {
            renderPatternComplete();
            return;
        }

        state = 'LESSON';
        currentFlowIndex = index;
        const entry = currentFlowEntries[index];

        showScreen('screen-quiz');
        setProgress(90 + (index / currentFlowEntries.length) * 10);

        const container = document.getElementById('quiz-content');
        const patternName = PATTERN_NAMES[entry.pattern] || entry.pattern;
        const icon = PATTERN_ICONS[entry.pattern] || '🧩';
        const topicLabel = (entry.topic_costume || '').replace(/-/g, ' ');
        const stepLabel = entry.step ? `Step ${entry.step}` : '';
        const knotLabel = entry.knot_name ? ` — ${entry.knot_name}` : '';

        const mascotArea = document.createElement('div');
        setMascot(mascotArea, 'thinking', entry.question);

        const progressTag = document.createElement('div');
        progressTag.style.cssText = 'text-align:center;font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;font-weight:600;';
        progressTag.textContent = `${icon} ${patternName} • ${stepLabel}${knotLabel} • Q${index + 1} of ${currentFlowEntries.length}`;

        const tag = document.createElement('div');
        tag.style.cssText = 'text-align:center;margin-bottom:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;';
        tag.innerHTML = `
            <span style="padding:4px 14px;background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.2);border-radius:999px;font-size:0.72rem;font-weight:700;color:var(--accent-3);text-transform:uppercase;">${topicLabel}</span>
            <span style="padding:4px 14px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:999px;font-size:0.72rem;font-weight:700;color:#3b82f6;">Difficulty ${entry.difficulty || '?'}/5</span>
        `;

        const optList = document.createElement('div');
        optList.className = 'option-list';
        entry.options.forEach((opt, i) => {
            const btn = document.createElement('div');
            btn.className = 'option-card';
            if (i === entry.correct_index) btn.classList.add('correct');
            btn.style.pointerEvents = 'none';
            btn.innerHTML = `<span style="width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;flex-shrink:0;color:var(--text-muted);">${String.fromCharCode(65+i)}</span><span>${opt}</span>`;
            optList.appendChild(btn);
        });

        // Built-in Explanation Block
        const explBlock = document.createElement('div');
        explBlock.className = 'worked-example-expl';
        explBlock.style.cssText = 'margin-top: 24px; padding: 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; font-size: 0.95rem; line-height: 1.6;';
        
        let explHTML = '';
        if (entry.knot_name || entry.pattern) {
            explHTML += `<div style="font-weight:800; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 12px; display:flex; align-items:center; gap:8px;"><span>${icon}</span> Knot/Pattern: ${entry.knot_name || patternName}</div>`;
        }
        if (entry.trick) explHTML += `<div style="margin-bottom: 12px;"><strong>Trick:</strong> ${entry.trick}</div>`;
        if (entry.why) explHTML += `<div style="margin-bottom: 12px;"><strong>Why:</strong> ${entry.why}</div>`;
        if (entry.why_others_wrong) explHTML += `<div style="margin-bottom: 12px;"><strong>Why others are wrong:</strong> ${entry.why_others_wrong}</div>`;
        if (entry.trap_type && entry.trap_explanation) explHTML += `<div style="margin-top: 16px; padding: 12px; background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; border-radius: 4px;"><strong>🚨 Trap (${entry.trap_type}):</strong> ${entry.trap_explanation}</div>`;
        explBlock.innerHTML = explHTML;

        // Checkpoint Buttons
        const checkpointDiv = document.createElement('div');
        checkpointDiv.style.marginTop = '24px';
        const checkpoint = entry.post_answer_checkpoint;
        
        if (checkpoint) {
            checkpointDiv.innerHTML = `
                <div style="margin-top:16px;font-size:0.85rem;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;text-align:center;">How well did you understand?</div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <button class="comp-btn" data-comp="understood" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(88,204,2,0.3);background:rgba(88,204,2,0.08);color:#58cc02;font-weight:600;font-size:0.88rem;cursor:pointer;">✅ Fully understood — move on</button>
                    <button class="comp-btn" data-comp="slightly_understood" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.08);color:#fbbf24;font-weight:600;font-size:0.88rem;cursor:pointer;">🤔 Got the gist, want to see more</button>
                    <button class="comp-btn" data-comp="some_doubts" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(59,130,246,0.3);background:rgba(59,130,246,0.08);color:#3b82f6;font-weight:600;font-size:0.88rem;cursor:pointer;">❓ Mostly clear, one point unclear</button>
                    <button class="comp-btn" data-comp="cant_apply_but_understood" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(168,85,247,0.3);background:rgba(168,85,247,0.08);color:#a855f7;font-weight:600;font-size:0.88rem;cursor:pointer;">🔧 Makes sense but can't apply it</button>
                    <button class="comp-btn" data-comp="nothing_understood" style="padding:12px 16px;border-radius:12px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);color:#ef4444;font-weight:600;font-size:0.88rem;cursor:pointer;">😵 Didn't understand at all</button>
                </div>
            `;
            checkpointDiv.querySelectorAll('.comp-btn').forEach(cbtn => {
                cbtn.addEventListener('click', () => {
                    handleComprehensionRoute(entry, cbtn.dataset.comp, true);
                });
            });
        } else {
            checkpointDiv.innerHTML = `<button style="width:100%; padding: 14px; border-radius: 12px; background: linear-gradient(135deg, #58cc02, #46a302); color: white; font-weight: 800; font-size: 1rem; border: none; cursor: pointer; box-shadow: 0 4px 0 #46a302;">CONTINUE</button>`;
            checkpointDiv.querySelector('button').addEventListener('click', () => {
                advanceFlow();
            });
        }

        container.innerHTML = '';
        container.appendChild(progressTag);
        container.appendChild(mascotArea);
        container.appendChild(tag);
        container.appendChild(optList);
        container.appendChild(explBlock);
        container.appendChild(checkpointDiv);

        $('.preview-action-bar').classList.add('hidden');
    }

    function renderSingleQuestion(entry) {
        // Insert this question as a one-off, then return to flow
        const savedIndex = currentFlowIndex;
        const tempEntries = currentFlowEntries;
        currentFlowEntries = [entry];
        currentFlowIndex = 0;

        const origAdvance = advanceFlow;
        // Override advance to go back to main flow
        advanceFlow = () => {
            currentFlowEntries = tempEntries;
            currentFlowIndex = savedIndex;
            advanceFlow = origAdvance;
            origAdvance();
        };

        renderPatternQuestion(0);
    }

    function handleComprehensionRoute(entry, comp, wasCorrect) {
        const checkpoint = entry.post_answer_checkpoint;

        if (checkpoint && checkpoint[comp]) {
            const nextId = checkpoint[comp].next;
            const resolved = engineReady ? ContentBank.resolveNext(nextId) : null;

            if (resolved === 'CONTINUE' || resolved === null) {
                advanceFlow();
            } else if (resolved.type === 'explanation') {
                renderExplanation(resolved, currentFlowEntries[currentFlowIndex + 1] || null);
            } else if (resolved.type === 'clarification') {
                renderClarification(resolved, null);
            } else if (resolved.type === 'guided_walkthrough') {
                renderGuidedWalkthrough(resolved);
            } else if (resolved.type === 'escalation') {
                renderEscalation(resolved);
            } else if (resolved.type === 'question') {
                renderSingleQuestion(resolved);
            }
        } else {
            advanceFlow();
        }
    }

    function advanceFlow() {
        currentFlowIndex++;

        // Persist topic progress to user profile
        const currentUser = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUserSync() : null;
        if (currentUser && selectedPickerTopic) {
            const topicId = selectedPickerTopic.id;
            currentUser.topicProgress = currentUser.topicProgress || {};
            const isCompleted = currentFlowIndex >= currentFlowEntries.length;
            currentUser.topicProgress[topicId] = {
                flowIndex: currentFlowIndex,
                completed: isCompleted,
                lastUpdated: Date.now()
            };
            AuthManager.updateCurrentUser({
                topicProgress: currentUser.topicProgress,
                xp: xp,
                streak: streak,
                hearts: hearts,
                confidenceStates: typeof engineReady !== 'undefined' && engineReady ? ConfidenceTracker.getAllStates() : {}
            });
        }

        if (currentFlowIndex >= currentFlowEntries.length) {
            renderPatternComplete();
            return;
        }

        const nextEntry = currentFlowEntries[currentFlowIndex];

        // Check if next entry needs an explanation first (based on confidence)
        if (nextEntry.explanation_id && engineReady) {
            const score = ConfidenceTracker.getScore(nextEntry.pattern);
            // Show explanation if score is low or this is a new knot
            if (score < 0.5 || (nextEntry.knot_id && nextEntry.step === 3)) {
                const explanation = ContentBank.getById(nextEntry.explanation_id);
                if (explanation && explanation.type === 'explanation') {
                    renderExplanation(explanation, nextEntry);
                    return;
                }
            }
        }

        renderPatternQuestion(currentFlowIndex);
    }

    function renderPatternComplete() {
        state = 'STUDY';
        setProgress(100);
        showScreen('screen-lesson');
        xp += 25;
        updateStats();

        const pattern = currentPatternFlow;
        const name = PATTERN_NAMES[pattern] || pattern;
        const icon = PATTERN_ICONS[pattern] || '📌';
        const level = engineReady ? ConfidenceTracker.getLevel(pattern) : 'EMERGING';
        const score = engineReady ? Math.round(ConfidenceTracker.getScore(pattern) * 100) : 0;

        const container = document.getElementById('lesson-content');
        const mascotArea = document.createElement('div');
        setMascot(mascotArea, 'happy', `Pattern complete! You earned 25 XP mastering ${name}! 🏆`);

        // Build close-out message (Step 6 of the Six-Step Unit)
        const knots = engineReady ? ContentBank.getQuestions(pattern).filter(q => q.knot_id).map(q => q.knot_name).filter((v, i, a) => v && a.indexOf(v) === i) : [];
        const knotList = knots.length > 0 ? knots.map(k => `• ${k}`).join('<br>') : 'No specific traps covered yet.';

        container.innerHTML = '';
        container.appendChild(mascotArea);
        container.innerHTML += `
            <div class="results-card">
                <div class="results-title" style="color:#ffc800;">🎉 ${icon} ${name} Complete!</div>
                <div class="results-subtitle">You now recognize this pattern and its traps</div>
                <div style="font-size:3rem;margin:24px 0;">⭐⭐⭐</div>
                <div style="margin-bottom:16px;">
                    <span style="font-size:2rem;font-weight:900;color:#ffc800;">+25 XP</span>
                </div>
                <div style="text-align:left;background:rgba(255,255,255,0.04);padding:16px;border-radius:12px;margin-bottom:20px;">
                    <div style="font-size:0.85rem;font-weight:700;color:var(--accent-3);margin-bottom:8px;">Current Level: ${level.replace(/_/g, ' ')} (${score}%)</div>
                    <div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.6;">
                        <strong>Traps covered:</strong><br>${knotList}
                    </div>
                </div>
                <button class="results-cta" id="back-to-patterns">Choose Another Pattern →</button>
            </div>
        `;

        showXPPopup('+25 XP');

        document.getElementById('back-to-patterns').addEventListener('click', () => {
            renderPostResultsChoice();
        });
    }

    // ---------- Check Button ----------
    function updateCheckBtn(enabled) {
        const btn = $('.preview-check-btn');
        if (!btn) return;
        btn.classList.toggle('enabled', enabled);
        btn.textContent = enabled ? 'Check' : 'Select an answer';
    }

    function handleCheck() {
        if (selectedOption === null) return;
        if (state === 'SURVEY') handleSurveyCheck();
        else if (state === 'QUIZ') handleQuizCheck();
    }

    // ---------- Public Init ----------
    async function open() {
        const currentUser = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUserSync() : null;
        if (!currentUser) {
            if (typeof AuthManager !== 'undefined') {
                AuthManager.openAuthModal(() => open());
            }
            return;
        }

        const overlay = $('#preview-overlay');
        if (overlay) {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Load engine if not already loaded
            if (!engineReady) {
                try {
                    await ContentBank.init(typeof CONTENT_BANK_URL !== 'undefined' ? CONTENT_BANK_URL : 'content-bank.json');
                    ConfidenceTracker.init();
                    engineReady = true;
                    console.log('[PreviewApp] Engine loaded successfully');
                } catch (e) {
                    console.error('[PreviewApp] Engine failed to load, using fallback:', e);
                    engineReady = false;
                }
            }

            // Sync user stats from AuthManager
            xp = currentUser.xp || 0;
            streak = currentUser.streak || 1;
            hearts = currentUser.hearts || 5;
            updateStats();

            // Check if user has already done diagnostic
            if (currentUser.hasCompletedDiagnostic && engineReady) {
                quizResults = currentUser.quizResults || [];
                renderPostResultsChoice();
            } else {
                renderSurvey();
            }
        }
    }

    function close() {
        const currentUser = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUserSync() : null;
        if (currentUser) {
            AuthManager.updateCurrentUser({
                xp: xp,
                streak: streak,
                hearts: hearts,
                confidenceStates: typeof engineReady !== 'undefined' && engineReady ? ConfidenceTracker.getAllStates() : {}
            });
        }

        const overlay = $('#preview-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    function init() {
        // Check button
        const checkBtn = $('.preview-check-btn');
        if (checkBtn) checkBtn.addEventListener('click', handleCheck);

        // Back button
        const backBtn = $('.preview-back-btn');
        if (backBtn) backBtn.addEventListener('click', () => {
            if (state === 'SURVEY' && surveyStep === 0) {
                close();
            } else if (state === 'SURVEY' && surveyStep > 0) {
                surveyStep--;
                renderSurvey();
            } else if (state === 'QUIZ') {
                renderSurvey();
            } else if (state === 'GENUINE_CHECK') {
                renderQuiz();
            } else if (state === 'GUESS_JOKE') {
                renderGenuineCheckScreen();
            } else if (state === 'RESULTS') {
                renderGenuineCheckScreen();
            } else if (state === 'CHOICE') {
                if (typeof AuthManager !== 'undefined') {
                    AuthManager.logOut();
                } else {
                    close();
                }
            } else if (state === 'PICKER') {
                renderPostResultsChoice();
            } else if (state === 'QUOTE_TRANSITION') {
                if (selectedPickerTopic) renderTopicPickerPage();
                else renderPostResultsChoice();
            } else if (state === 'APTITUDE_SIGNIFICANCE') {
                if (window.aptSignificanceTimer) clearInterval(window.aptSignificanceTimer);
                if (significanceStep > 0) renderAptitudeSignificanceScreen(selectedPickerTopic, significanceStep - 1);
                else renderSharpenAxeQuoteScreen(selectedPickerTopic);
            } else if (state === 'STUDY' || state === 'LESSON') {
                renderPostResultsChoice();
            } else {
                close();
            }
        });

        // Topbar Profile Icon button
        const profileBtn = document.getElementById('pv-profile-btn');
        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                const currentUser = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUserSync() : null;
                if (currentUser) {
                    alert(`👤 Profile: ${currentUser.name}\n📧 Email: ${currentUser.email}\n⚡ XP: ${currentUser.xp || 0}\n🔥 Streak: ${currentUser.streak || 1}\n✅ Diagnostic: ${currentUser.hasCompletedDiagnostic ? 'Completed' : 'Pending'}`);
                }
            });
        }
    }

    return { open, close, init };
})();
