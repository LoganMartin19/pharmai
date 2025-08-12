// src/utils/medParser.ts
type Parsed = {
    name?: string;
    dosage?: string;          // e.g. "500 mg" or "1 tablet"
    frequency?: 'Once daily' | 'Twice daily' | 'Three times daily';
    everyHours?: number;      // e.g. 8 (if text says "every 8 hours")
  };
  
  const WORD_NUM: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  
  const UNIT_WORDS = ['tablet', 'tablets', 'tab', 'tabs', 'capsule', 'capsules', 'cap', 'caps', 'puff', 'puffs', 'ml', 'mg', 'mcg', 'g'];
  
  function normalize(raw: string) {
    // join lines, collapse spaces, unify hyphen variants
    let t = raw.replace(/\r/g, '\n').replace(/\u2013|\u2014/g, '-').replace(/[•·]/g, ' ');
    t = t.split('\n').map(s => s.trim()).filter(Boolean).join(' ');
    t = t.replace(/\s*-\s*/g, ' - '); // space around hyphen for splitting
    return t.replace(/\s+/g, ' ');
  }
  
  function pickName(text: string): string | undefined {
    // Heuristic: take tokens until we hit a dosage token or a hyphen separator
    const tokens = text.split(' ');
    const nameTokens: string[] = [];
    for (const tok of tokens) {
      const low = tok.toLowerCase();
      if (low === '-' || /^(?:\d+(\.\d+)?)(mg|ml|mcg|g)$/.test(low) || UNIT_WORDS.includes(low.replace(/s$/, ''))) {
        break;
      }
      nameTokens.push(tok);
    }
    // If nothing before hyphen, take the first token as name
    return nameTokens.length ? nameTokens.join(' ') : tokens[0];
  }
  
  function parseDose(text: string): string | undefined {
    const t = text.toLowerCase();
  
    // mg/ml strength like "500mg", "5 ml", "0.5 g"
    const strength = t.match(/\b(\d+(?:\.\d+)?)\s?(mg|ml|mcg|g)\b/);
    // count + unit like "1 tablet", "two capsules"
    const countUnit = t.match(/\b((?:\d+)|(?:one|two|three|four|five|six|seven|eight|nine|ten))\s?(tablet|tablets|tab|tabs|capsule|capsules|cap|caps|puff|puffs)\b/);
  
    const strengthText = strength ? `${strength[1]} ${strength[2].toUpperCase()}` : undefined;
  
    let qtyText: string | undefined;
    if (countUnit) {
      const rawNum = countUnit[1];
      const num = WORD_NUM[rawNum] ?? (parseInt(rawNum || '0', 10) || undefined);
      const unit = countUnit[2];
      if (num) {
        const unitSingular = unit.endsWith('s') ? unit.slice(0, -1) : unit;
        qtyText = `${num} ${unitSingular}`;
      }
    }
  
    // Prefer explicit quantity like "1 tablet"; otherwise return strength like "500 mg"
    return qtyText ?? strengthText;
  }
  
  function parseFrequency(text: string): { frequency?: Parsed['frequency']; everyHours?: number } {
    const t = ` ${text.toLowerCase()} `;
  
    // plain language
    if (/\bonce(?:\s+(a|per))?\s+day|daily\b/.test(t)) return { frequency: 'Once daily' };
    if (/\btwice(?:\s+(a|per))?\s+day\b/.test(t)) return { frequency: 'Twice daily' };
    if (/\b(three|3)\s+(times\s+)?(?:a|per)\s+day\b/.test(t)) return { frequency: 'Three times daily' };
  
    // abbreviations
    if (/\bod\b/.test(t)) return { frequency: 'Once daily' };  // omni die
    if (/\bbid\b/.test(t)) return { frequency: 'Twice daily' };
    if (/\btid\b/.test(t)) return { frequency: 'Three times daily' };
  
    // every N hours
    const every = t.match(/\bevery\s+(\d+|\w+)\s+hours?\b/);
    if (every) {
      const raw = every[1];
      const num = WORD_NUM[raw] ?? (parseInt(raw || '0', 10) || undefined);
      if (num && num > 0) return { everyHours: num };
    }
  
    return {};
  }
  
  export function parseMedicationText(raw: string): Parsed {
    const text = normalize(raw);
  
    // Try to split on the first " - " if present: "Amoxicillin 500mg - take one tablet twice daily"
    const [left, right] = text.split(/\s-\s(.+)/);
  
    const namePart = right ? left : text;
    const detailPart = right ?? text;
  
    const name = pickName(namePart) || undefined;
    const dosage = parseDose(detailPart);
    const { frequency, everyHours } = parseFrequency(detailPart);
  
    return { name, dosage, frequency, everyHours };
  }