import { describe, it, expect } from 'vitest';
import { parseMessage, parseNaturalAction, normalizeText, normalizePreservingLines } from '../src/lib/agent/router';

describe('Agent Natural Language Parser & Router', () => {
  describe('Prompt Required Cases', () => {
    it('should parse multiline employee creation with 100% accuracy', () => {
      const input = `akkas nam er employee profile banao\nakkas@gmail.com\n000000`;
      const res = parseMessage(input);

      expect(res.command).toBe('team');
      expect(res.args).toEqual([
        'add',
        'name=akkas',
        'password=000000',
        'email=akkas@gmail.com',
      ]);
      // Verify password is never mistaken for name, and name is never mistaken for password
      expect(res.args).toContain('name=akkas');
      expect(res.args).toContain('password=000000');
      expect(res.args).not.toContain('name=000000');
      expect(res.args).not.toContain('password=akkas');
    });

    it('should parse single-line employee creation (akkas nam er employee profile banao akkas@gmail.com 000000)', () => {
      const input = 'akkas nam er employee profile banao akkas@gmail.com 000000';
      const res = parseMessage(input);

      expect(res.command).toBe('team');
      expect(res.args).toEqual([
        'add',
        'name=akkas',
        'password=000000',
        'email=akkas@gmail.com',
      ]);
    });

    it('should parse English create employee (create employee akkas pass 000000 email akkas@gmail.com)', () => {
      const input = 'create employee akkas pass 000000 email akkas@gmail.com';
      const res = parseMessage(input);

      expect(res.command).toBe('team');
      expect(res.args).toEqual([
        'add',
        'name=akkas',
        'password=000000',
        'email=akkas@gmail.com',
      ]);
    });

    it('should parse Banglish notun kormi (notun kormi banao rofik password 123456)', () => {
      const input = 'notun kormi banao rofik password 123456';
      const res = parseMessage(input);

      expect(res.command).toBe('team');
      expect(res.args).toEqual([
        'add',
        'name=rofik',
        'password=123456',
      ]);
    });

    it('should parse Bangla employee creation (রফিক নামে কর্মী বানাও পাস 123456 rofik@gmail.com)', () => {
      const input = 'রফিক নামে কর্মী বানাও পাস 123456 rofik@gmail.com';
      const res = parseMessage(input);

      expect(res.command).toBe('team');
      expect(res.args).toEqual([
        'add',
        'name=রফিক',
        'password=123456',
        'email=rofik@gmail.com',
      ]);
    });

    it('should parse Banglish section assignment (Arif ke Dhaka Farmers e assign koro)', () => {
      const input = 'Arif ke Dhaka Farmers e assign koro';
      const res = parseMessage(input);

      expect(res.command).toBe('assign');
      expect(res.args).toEqual(['Arif', 'to', 'Dhaka Farmers']);
    });

    it('should parse English section assignment (assign Arif to Dhaka Farmers)', () => {
      const input = 'assign Arif to Dhaka Farmers';
      const res = parseMessage(input);

      expect(res.command).toBe('assign');
      expect(res.args).toEqual(['Arif', 'to', 'Dhaka Farmers']);
    });

    it('should parse customer permission grant (give Arif permission to view all customers)', () => {
      const input = 'give Arif permission to view all customers';
      const res = parseMessage(input);

      expect(res.command).toBe('permission');
      expect(res.args).toEqual(['Arif', 'grant']);
    });

    it('should parse customer permission revoke (Arif er customer access bondho koro)', () => {
      const input = 'Arif er customer access bondho koro';
      const res = parseMessage(input);

      expect(res.command).toBe('permission');
      expect(res.args).toEqual(['Arif', 'revoke']);
    });

    it('should parse password reset (set password of akkas to 654321)', () => {
      const input = 'set password of akkas to 654321';
      const res = parseMessage(input);

      expect(res.command).toBe('password');
      expect(res.args).toEqual(['akkas', '654321']);
    });
  });

  describe('Additional Edge Cases & Variations', () => {
    it('handles multiline with password on line 2 and email on line 3', () => {
      const input = `akkas nam er employee profile banao\n000000\nakkas@gmail.com`;
      const res = parseMessage(input);

      expect(res.command).toBe('team');
      expect(res.args).toEqual([
        'add',
        'name=akkas',
        'password=000000',
        'email=akkas@gmail.com',
      ]);
    });

    it('handles multiline labeled fields', () => {
      const input = `employee profile banao\nname: akkas\npassword: 000000\nemail: akkas@gmail.com`;
      const res = parseMessage(input);

      expect(res.command).toBe('team');
      expect(res.args).toEqual([
        'add',
        'name=akkas',
        'password=000000',
        'email=akkas@gmail.com',
      ]);
    });

    it('handles multiline plain line candidate for name', () => {
      const input = `employee profile banao\nakkas\nakkas@gmail.com\n000000`;
      const res = parseMessage(input);

      expect(res.command).toBe('team');
      expect(res.args).toEqual([
        'add',
        'name=akkas',
        'password=000000',
        'email=akkas@gmail.com',
      ]);
    });

    it('handles multi-word names in employee creation', () => {
      const input1 = 'create employee Akkas Ali pass 000000 email akkas@gmail.com';
      const res1 = parseMessage(input1);
      expect(res1.command).toBe('team');
      expect(res1.args).toEqual([
        'add',
        'name=Akkas Ali',
        'password=000000',
        'email=akkas@gmail.com',
      ]);

      const input2 = `Akkas Ali nam er employee profile banao\nakkas@gmail.com\n000000`;
      const res2 = parseMessage(input2);
      expect(res2.command).toBe('team');
      expect(res2.args).toEqual([
        'add',
        'name=Akkas Ali',
        'password=000000',
        'email=akkas@gmail.com',
      ]);

      const input3 = 'রফিক আহমেদ নামে কর্মী বানাও পাস 123456 rofik@gmail.com';
      const res3 = parseMessage(input3);
      expect(res3.command).toBe('team');
      expect(res3.args).toEqual([
        'add',
        'name=রফিক আহমেদ',
        'password=123456',
        'email=rofik@gmail.com',
      ]);
    });

    it('handles multi-word names in assignment, permissions, and password', () => {
      expect(parseMessage('assign Md Arif to Dhaka Farmers')).toEqual({
        command: 'assign',
        args: ['Md Arif', 'to', 'Dhaka Farmers'],
        raw: 'assign Md Arif to Dhaka Farmers',
      });

      expect(parseMessage('give Arif Hossain permission to view all customers')).toEqual({
        command: 'permission',
        args: ['Arif Hossain', 'grant'],
        raw: 'give Arif Hossain permission to view all customers',
      });

      expect(parseMessage('Arif Hossain er customer access bondho koro')).toEqual({
        command: 'permission',
        args: ['Arif Hossain', 'revoke'],
        raw: 'Arif Hossain er customer access bondho koro',
      });

      expect(parseMessage('set password of Akkas Ali to 654321')).toEqual({
        command: 'password',
        args: ['Akkas Ali', '654321'],
        raw: 'set password of Akkas Ali to 654321',
      });
    });

    it('converts Bangla numerals to ASCII digits in passwords', () => {
      const input1 = 'রফিক নামে কর্মী বানাও পাস ১২৩৪৫৬ rofik@gmail.com';
      const res1 = parseMessage(input1);
      expect(res1.command).toBe('team');
      expect(res1.args).toEqual([
        'add',
        'name=রফিক',
        'password=123456',
        'email=rofik@gmail.com',
      ]);

      const input2 = `akkas nam er employee profile banao\nakkas@gmail.com\n০০০০০০`;
      const res2 = parseMessage(input2);
      expect(res2.command).toBe('team');
      expect(res2.args).toEqual([
        'add',
        'name=akkas',
        'password=000000',
        'email=akkas@gmail.com',
      ]);

      const input3 = 'set password of akkas to ৬৫৪৩২১';
      const res3 = parseMessage(input3);
      expect(res3.command).toBe('password');
      expect(res3.args).toEqual(['akkas', '654321']);
    });

    it('handles punctuation and colons properly', () => {
      const input1 = 'create employee: akkas, pass: 000000, email: akkas@gmail.com';
      const res1 = parseMessage(input1);
      expect(res1.command).toBe('team');
      expect(res1.args).toEqual([
        'add',
        'name=akkas',
        'password=000000',
        'email=akkas@gmail.com',
      ]);

      const input2 = 'notun kormi banao: rofik, password: 123456';
      const res2 = parseMessage(input2);
      expect(res2.command).toBe('team');
      expect(res2.args).toEqual([
        'add',
        'name=rofik',
        'password=123456',
      ]);
    });

    it('handles hashtag commands correctly', () => {
      expect(parseMessage('#team add name=akkas password=000000 email=akkas@gmail.com')).toEqual({
        command: 'team',
        args: ['add', 'name=akkas', 'password=000000', 'email=akkas@gmail.com'],
        raw: '#team add name=akkas password=000000 email=akkas@gmail.com',
      });

      expect(parseMessage('#assign Arif to Dhaka Farmers')).toEqual({
        command: 'assign',
        args: ['Arif', 'to', 'Dhaka', 'Farmers'],
        raw: '#assign Arif to Dhaka Farmers',
      });
    });

    it('handles plain multiline credentials and how-to questions', () => {
      const plainCreds = parseMessage('Akkas\nakkas@gmail.com\n123456');
      expect(plainCreds.command).toBe('team');
      expect(plainCreds.args).toEqual(['add', 'name=Akkas', 'password=123456', 'email=akkas@gmail.com']);

      const alphaCreds = parseMessage('Faruk\nfaruk@gmail.com\npassword123');
      expect(alphaCreds.command).toBe('team');
      expect(alphaCreds.args).toEqual(['add', 'name=Faruk', 'password=password123', 'email=faruk@gmail.com']);

      const bnCreds = parseMessage('নাম: সুমন\nফোন: 01712345678\nপাসওয়ার্ড: 112233');
      expect(bnCreds.command).toBe('team');
      expect(bnCreds.args).toEqual(['add', 'name=সুমন', 'password=112233', 'phone=01712345678']);

      const idBanao = parseMessage('Akkas er employee id banao password 123456 email akkas@gmail.com');
      expect(idBanao.command).toBe('team');
      expect(idBanao.args).toEqual(['add', 'name=Akkas', 'password=123456', 'email=akkas@gmail.com']);

      const howTo = parseMessage('kormi add korbo kivabe');
      expect(howTo.command).toBeNull();
    });
  });
});
