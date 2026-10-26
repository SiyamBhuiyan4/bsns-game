import { describe, it, expect } from 'vitest';
import { parseMessage } from '../router';

describe('Agent Router & Natural Action Parser', () => {
  describe('Exact Screenshot Error Test', () => {
    it('properly extracts name="akkas", email="akkas@gmail.com", password="000000" and routes to team add', () => {
      const input = 'akkas nam er employee profile banao\nakkas@gmail.com\n000000';
      const parsed = parseMessage(input);

      expect(parsed.command).toBe('team');
      expect(parsed.args).toContain('add');
      expect(parsed.args).toContain('name=akkas');
      expect(parsed.args).toContain('password=000000');
      expect(parsed.args).toContain('email=akkas@gmail.com');
      expect(parsed.raw).toBe(input);
    });
  });

  describe('20+ Variations: Names, Domains, Passwords & Line Orders', () => {
    // 1. Rahim - Yahoo - Alpha password - Instruction -> Email -> Password
    it('Var 1: Rahim with yahoo.com and alpha password (Instruction -> Email -> Pass)', () => {
      const input = 'Rahim nam er employee profile banao\nrahim@yahoo.com\nsecretpass';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Rahim', 'password=secretpass', 'email=rahim@yahoo.com']);
    });

    // 2. Karim - Outlook - Alphanumeric password with symbols - Instruction -> Password -> Email
    it('Var 2: Karim with outlook.com and alphanumeric password (Instruction -> Pass -> Email)', () => {
      const input = 'Karim nam er employee profile banao\nKarim@2026\nkarim@outlook.com';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Karim', 'password=Karim@2026', 'email=karim@outlook.com']);
    });

    // 3. Sumaiya - Corporate org - Alphanumeric password - Email -> Password -> Instruction
    it('Var 3: Sumaiya with corp.org (Email -> Pass -> Instruction)', () => {
      const input = 'sumaiya@corp.org\nabc12345\nSumaiya namer employee account banao';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Sumaiya', 'password=abc12345', 'email=sumaiya@corp.org']);
    });

    // 4. Akkas - Gmail - Pure numeric password - Pass -> Email -> Instruction
    it('Var 4: Akkas with gmail.com (Pass -> Email -> Instruction)', () => {
      const input = '000000\nakkas@gmail.com\nakkas nam er employee profile banao';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=akkas', 'password=000000', 'email=akkas@gmail.com']);
    });

    // 5. Siyam - Tech domain - Numeric 6-digit - Pass -> Instruction -> Email
    it('Var 5: Siyam with tech.co (Pass -> Instruction -> Email)', () => {
      const input = '654321\nSiyam nam er employee profile banao\nsiyam@tech.co';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Siyam', 'password=654321', 'email=siyam@tech.co']);
    });

    // 6. Tanvir - Hotmail - Alphanumeric starting with pass - Email -> Instruction -> Pass
    it('Var 6: Tanvir with hotmail.com and pass-prefixed password (Email -> Instruction -> Pass)', () => {
      const input = 'tanvir@hotmail.com\nTanvir nam er employee profile banao\npass9876';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Tanvir', 'password=pass9876', 'email=tanvir@hotmail.com']);
    });

    // 7. Fatima - Bangladesh domain .bd - Complex password - With extra blank lines
    it('Var 7: Fatima with bd domain and blank lines', () => {
      const input = '\n\nFatima nam er employee profile banao\n\nfatima@dhaka.gov.bd\n\nFatima#2026\n\n';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Fatima', 'password=Fatima#2026', 'email=fatima@dhaka.gov.bd']);
    });

    // 8. Jahid - Custom sub-domain - Mixed case password - "er jonno employee"
    it('Var 8: Jahid with custom subdomain using "er jonno employee"', () => {
      const input = 'Jahid er jonno employee account banao\njahid@sales.agency.io\nJahidPass99';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Jahid', 'password=JahidPass99', 'email=jahid@sales.agency.io']);
    });

    // 9. Nusrat - Protonmail - 8-digit numeric password - "namer kormi"
    it('Var 9: Nusrat with protonmail and "namer kormi"', () => {
      const input = 'Nusrat namer kormi profile banao\nnusrat@proton.me\n11223344';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Nusrat', 'password=11223344', 'email=nusrat@proton.me']);
    });

    // 10. Arif - iCloud - Password with underscore - "notun kormi"
    it('Var 10: Arif with icloud using "notun kormi"', () => {
      const input = 'notun kormi Arif nam er profile banao\narif@icloud.com\narif_secure_pass';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Arif', 'password=arif_secure_pass', 'email=arif@icloud.com']);
    });

    // 11. Bangla Unicode Name আক্কাস - Bangla text: নামের কর্মচারী প্রোফাইল বানাও
    it('Var 11: Bangla script আক্কাস with Bengali phrasing', () => {
      const input = 'আক্কাস নামের কর্মচারী প্রোফাইল বানাও\nakkas@bdmail.com\n889900';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=আক্কাস', 'password=889900', 'email=akkas@bdmail.com']);
    });

    // 12. Bangla Unicode Name রহিম - Bangla text: রহিমের কর্মী একাউন্ট খোলো
    it('Var 12: Bangla script রহিম with "রহিমের কর্মী একাউন্ট খোলো"', () => {
      const input = 'রহিমের কর্মী একাউন্ট খোলো\nrahim@desh.net\nrahimPass1';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=রহিম', 'password=rahimPass1', 'email=rahim@desh.net']);
    });

    // 13. Explicit labels with colons: name: X, pass: Y, email: Z
    it('Var 13: Explicit key-value labels with colons', () => {
      const input = 'create employee name: Kabir email: kabir@corp.com pass: secret999';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Kabir', 'password=secret999', 'email=kabir@corp.com']);
    });

    // 14. Explicit labels multi-line with bangla label নাম: ও পাসওয়ার্ড:
    it('Var 14: Multi-line explicit labels with Bengali keys', () => {
      const input = 'নতুন কর্মচারী তৈরি করো\nনাম: সালমান\nইমেইল: salman@gmail.com\nপাসওয়ার্ড: salman123';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=সালমান', 'password=salman123', 'email=salman@gmail.com']);
    });

    // 15. Including a Bangladeshi phone number in the block
    it('Var 15: Payload containing phone number along with email and password', () => {
      const input = 'Mehedi nam er employee profile banao\nmehedi@gmail.com\n01712345678\nmehedi789';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toContain('add');
      expect(res.args).toContain('name=Mehedi');
      expect(res.args).toContain('password=mehedi789');
      expect(res.args).toContain('email=mehedi@gmail.com');
      expect(res.args).toContain('phone=01712345678');
    });

    // 16. Passwords with special characters: @ # $ % !
    it('Var 16: Password with complex special symbols', () => {
      const input = 'Rina nam er employee profile banao\nrina@enterprise.biz\nRina@2026!';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Rina', 'password=Rina@2026!', 'email=rina@enterprise.biz']);
    });

    // 17. English "create employee" format: create employee Tariq tariq@gmail.com TariqPass
    it('Var 17: English action "create employee" format', () => {
      const input = 'create employee Tariq\ntariq@gmail.com\nTariqPass';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Tariq', 'password=TariqPass', 'email=tariq@gmail.com']);
    });

    // 18. Bangla digits in password normalized: ১২৩৪৫৬ -> 123456
    it('Var 18: Bangla digits in password converted to standard ASCII digits', () => {
      const input = 'Habib nam er employee profile banao\nhabib@gmail.com\n১২৩৪৫৬';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Habib', 'password=123456', 'email=habib@gmail.com']);
    });

    // 19. All on a single line with space delimiters
    it('Var 19: All fields on a single line: "notun employee banao Shamim shamim@gmail.com secret123"', () => {
      const input = 'notun employee banao Shamim shamim@gmail.com secret123';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Shamim', 'password=secret123', 'email=shamim@gmail.com']);
    });

    // 20. "add employee name: Anis pass: 123456"
    it('Var 20: "add employee name: Anis pass: 123456" without email', () => {
      const input = 'add employee name: Anis pass: 123456';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Anis', 'password=123456']);
    });

    // 21. Reordered: Email on top, instruction in middle, password on bottom
    it('Var 21: Email first line, instruction middle, password last', () => {
      const input = 'rubel@agency.com\nRubel nam er employee profile banao\nRubelPass88';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Rubel', 'password=RubelPass88', 'email=rubel@agency.com']);
    });

    // 22. Reordered: Password first line, instruction middle, email last
    it('Var 22: Password first line, instruction middle, email last', () => {
      const input = '999888\nKamal nam er employee profile banao\nkamal@workplace.net';
      const res = parseMessage(input);
      expect(res.command).toBe('team');
      expect(res.args).toEqual(['add', 'name=Kamal', 'password=999888', 'email=kamal@workplace.net']);
    });
  });

  describe('Non-Action / Routine Questions Guard', () => {
    it('does not route normal navigation questions to team add', () => {
      expect(parseMessage('kivabe employee add korbo?').command).toBeNull();
      expect(parseMessage('how to view employees?').command).toBeNull();
      expect(parseMessage('dashboard dekhao').command).toBeNull();
      expect(parseMessage('employee list kothay pabo').command).toBeNull();
    });
  });
});
