/**
 * lib/ai/stream-json.ts
 *
 * SSE stream'dan kelayotgan xom matndan `"reply"` qiymatini
 * INCREMENTAL chiqarish. Nima uchun kerak: model JSON protokol bilan
 * javob beradi (`{"reply":"...","actions":[...]}`), token-level streaming
 * uchun javob to'liq kelishini KUTMASDAN reply matnini bo'laklab
 * mijozga yuborish kerak.
 *
 * JSON string escape'larini (`\n`, `\"`, `\\`, `\uXXXX` va h.k.) to'g'ri
 * decode qiladi; chunk chegarasida uzilgan escape keyingi chunk'da
 * davom etadi.
 */

export class ReplyDeltaExtractor {
  /** Hali ishlanmagan xom matn (kalit izlash yoki qiymat davomi). */
  private buffer = "";
  /** Reply qiymati boshlanishi topildimi. */
  private started = false;
  /** Yopuvchi `"` topildimi — reply tugagan. */
  private finishedFlag = false;
  /** Yig'ilgan toza matn. */
  private out = "";

  /**
   * Yangi xom bo'lak. Qaytaradi: shu bo'lakdan chiqqan YANGI toza
   * matn (delta). Bo'sh string — hali chiqariladigan narsa yo'q.
   */
  push(chunk: string): string {
    if (this.finishedFlag || !chunk) return "";
    this.buffer += chunk;

    if (!this.started) {
      const m = /"reply"\s*:\s*"/.exec(this.buffer);
      if (!m) {
        // Kalit chunk chegarasida bo'linishi mumkin — oxirgi belgilarni saqlaymiz
        if (this.buffer.length > 32) this.buffer = this.buffer.slice(-32);
        return "";
      }
      this.buffer = this.buffer.slice(m.index + m[0].length);
      this.started = true;
    }

    let delta = "";
    let i = 0;
    while (i < this.buffer.length) {
      const ch = this.buffer[i];
      if (ch === "\\") {
        const decoded = tryDecodeEscape(this.buffer.slice(i));
        if (!decoded) break; // yarim qolgan escape — keyingi chunk'da
        delta += decoded.char;
        i += decoded.length;
        continue;
      }
      if (ch === '"') {
        // Yopuvchi qo'shtirnoq — reply tugadi
        this.finishedFlag = true;
        i += 1;
        break;
      }
      delta += ch;
      i += 1;
    }

    this.buffer = this.buffer.slice(i);
    this.out += delta;
    return delta;
  }

  /** Reply to'liq yopildimi. */
  get finished(): boolean {
    return this.finishedFlag;
  }

  /** Hozirgacha yig'ilgan to'liq reply matni. */
  get text(): string {
    return this.out;
  }
}

/**
 * `\X` escape'ni decode qilish. To'liq bo'lsa {char, length},
 * yarim qolgan bo'lsa null.
 */
function tryDecodeEscape(rest: string): { char: string; length: number } | null {
  if (rest.length < 2) return null;
  const c = rest[1];
  switch (c) {
    case "n": return { char: "\n", length: 2 };
    case "t": return { char: "\t", length: 2 };
    case "r": return { char: "\r", length: 2 };
    case "b": return { char: "\b", length: 2 };
    case "f": return { char: "\f", length: 2 };
    case "/": return { char: "/", length: 2 };
    case '"': return { char: '"', length: 2 };
    case "\\": return { char: "\\", length: 2 };
    case "u": {
      if (rest.length < 6) return null;
      const hex = rest.slice(2, 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) return { char: rest.slice(0, 2), length: 2 };
      return { char: String.fromCharCode(parseInt(hex, 16)), length: 6 };
    }
    default:
      return { char: c, length: 2 };
  }
}
