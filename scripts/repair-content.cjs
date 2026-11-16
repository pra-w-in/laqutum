// Restores missing questions using the existing successive-discount lessons.
const fs = require('node:fs');
const file = 'content-bank.json';
const bank = JSON.parse(fs.readFileSync(file, 'utf8'));
const originalCount = bank.entries.length;
const rows = [
 ['clean_01', 'An item costs ₹1,000. It is marked up by 50% and then discounted by 20%. What is the profit percentage?', ['20%', '30%', '25%', '10%'], '1000 × 1.50 × 0.80 = 1200; profit = 200/1000 × 100 = 20%.'],
 ['disc-net_02', 'An item marked ₹2,000 receives successive discounts of 20% and 10%. Find its selling price.', ['₹1,440', '₹1,400', '₹1,600', '₹1,800'], '2000 × 0.80 × 0.90 = 1440.'],
 ['disc-net_03', 'An item marked ₹1,000 receives successive discounts of 10% and 20%. Find its selling price.', ['₹720', '₹700', '₹800', '₹900'], '1000 × 0.90 × 0.80 = 720.'],
 ['three-disc_05', 'An item marked ₹10,000 receives successive discounts of 10%, 20%, and 10%. Find its selling price.', ['₹6,480', '₹6,000', '₹7,200', '₹6,400'], '10000 × 0.90 × 0.80 × 0.90 = 6480.'],
 ['three-disc_06', 'An item marked ₹5,000 receives successive discounts of 20%, 10%, and 10%. Find its selling price.', ['₹3,240', '₹3,000', '₹3,600', '₹3,200'], '5000 × 0.80 × 0.90 × 0.90 = 3240.'],
 ['markup-disc_08', 'An item costs ₹1,000, is marked up by 40%, and then discounted by 10%. Find the profit percentage.', ['26%', '30%', '36%', '20%'], '1.40 × 0.90 = 1.26, so profit is 26% of cost price.'],
 ['markup-disc_09', 'An item is marked up by 25% over cost and discounted by 20%. Find the profit percentage.', ['0%', '5%', '10%', '20%'], '1.25 × 0.80 = 1.00: selling price equals cost price.'],
 ['reverse-mp_11', 'An item costs ₹800. What marked price gives 8% profit after a 10% discount?', ['₹960', '₹950', '₹880', '₹864'], 'Required selling price = 800 × 1.08 = 864. Marked price = 864 / 0.90 = 960.'],
 ['reverse-mp_12', 'An item costs ₹1,000. What marked price gives 20% profit after a 20% discount?', ['₹1,500', '₹1,400', '₹1,440', '₹1,200'], 'Required selling price = 1200. Marked price = 1200 / 0.80 = 1500.'],
 ['dishonest-dealer_14', 'A dealer charges 20% above the cost of 1 kg but supplies only 800 g for each claimed kilogram. What is the profit percentage on the actual goods supplied?', ['50%', '40%', '45%', '25%'], 'Revenue/cost = 1.20 / 0.80 = 1.50, so profit is 50%.'],
 ['dishonest-dealer_15', 'A dealer charges the cost price of 1 kg but supplies only 800 g. What is the profit percentage on the actual goods supplied?', ['25%', '20%', '15%', '0%'], 'Revenue/cost = 1 / 0.80 = 1.25, so profit is 25%.'],
 ['equiv-single_17', 'What single discount is equivalent to successive discounts of 10% and 20%?', ['28%', '30%', '32%', '25%'], 'Retained price = 0.90 × 0.80 = 0.72. Discount = 1 − 0.72 = 28%.'],
 ['equiv-single_18', 'What single discount is equivalent to two successive discounts of 20%?', ['36%', '40%', '32%', '44%'], 'Retained price = 0.80 × 0.80 = 0.64. Discount = 36%.'],
];
for (const [suffix, question, options, why] of rows) {
 const id = 'p7_profit-loss-successive_' + suffix;
 if (bank.entries.some(e => e.id === id)) continue;
 const source = bank.entries.find(e => e.type === 'explanation' && Object.values(e.checkpoint_options || {}).some(v => v.next === id));
 if (!source) throw new Error('Missing source lesson: ' + id);
 bank.entries.push({ id, type: 'question', pattern: source.pattern, topic_costume: source.topic_costume,
   knot_id: source.knot_id, knot_name: source.knot_id, step: source.knot_id ? 3 : 1, difficulty: source.knot_id ? 2 : 1,
   explanation_id: source.id, question, options, correct_index: 0, trick: 'Multiply the successive price factors; each change uses the current price.', why,
   why_others_wrong: 'Apply each percentage to the correct base. Successive percentage changes multiply rather than add.',
   post_answer_checkpoint: { understood: { next: 'CONTINUE' }, nothing_understood: { next: source.id },
     some_doubts: { next: source.id }, slightly_understood: { next: source.id }, cant_apply_but_understood: { next: source.id } }, author_reviewed: false });
}
const aliases = { knot_averaging_averages_drill1: 'p1_averages_averagingaverages_drill1', knot_new_entry_shift_drill1: 'p6_averages_newentry_drill1' };
let ids = new Set(bank.entries.map(e => e.id));
for (const e of [...bank.entries]) for (const map of [e.checkpoint_options, e.post_answer_checkpoint]) {
 for (const value of Object.values(map || {})) {
   if (aliases[value.next]) value.next = aliases[value.next];
   if (value.next.startsWith('escalation_generic_') && !ids.has(value.next)) {
     const pattern = value.next.match(/_p(\d+)/)[1];
     bank.entries.push({ id: value.next, type: 'escalation', pattern: 'P' + pattern,
       content: 'It is okay to need another pass. Write down what is given, what must be found, and which quantities change together. Work through the guided example one step at a time. If the connection is still unclear, pause this pattern and return after another example.', author_reviewed: false });
     ids.add(value.next);
   }
 }
}
bank.stats.totalEntries = bank.entries.length;
bank.stats.v2Entries += bank.entries.length - originalCount;
bank.stats.danglingReferences = [];
bank.stats.warnings = (bank.stats.warnings || []).filter(w => !w.startsWith('Dangling reference:'));
bank.stats.lastUpdated = new Date().toISOString();
fs.writeFileSync(file, JSON.stringify(bank, null, 2) + '\n');
console.log('Content entries:', bank.entries.length);
