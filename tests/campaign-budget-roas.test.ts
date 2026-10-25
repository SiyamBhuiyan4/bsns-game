import { describe, it, expect } from 'vitest';
import {
  calculateROAS,
  evaluateCampaignBudget,
  VALID_CAMPAIGN_CHANNELS,
  CHANNEL_DISPLAY_CONFIG,
} from '../src/lib/campaigns';
import { CampaignChannel } from '@prisma/client';

describe('Campaigns, Ad Spend, ROAS & Budget Management Engine', () => {
  describe('1. Channels Verification', () => {
    it('should support all 5 required channels', () => {
      const requiredChannels: CampaignChannel[] = [
        'FACEBOOK_GROUP',
        'FACEBOOK_AD',
        'GOOGLE_AD',
        'YOUTUBE',
        'OTHER',
      ];

      for (const ch of requiredChannels) {
        expect(VALID_CAMPAIGN_CHANNELS).toContain(ch);
        expect(CHANNEL_DISPLAY_CONFIG[ch]).toBeDefined();
        expect(CHANNEL_DISPLAY_CONFIG[ch].labelBn).toBeTruthy();
        expect(CHANNEL_DISPLAY_CONFIG[ch].labelEn).toBeTruthy();
      }
    });
  });

  describe('2. ROAS Calculations (Revenue / Ad Spend)', () => {
    it('should calculate ROAS correctly when revenue and spend exist', () => {
      // ৳50,000 revenue with ৳10,000 ad spend = 5.00x
      const roas1 = calculateROAS(50000, 10000);
      expect(roas1).toBe(5);

      // ৳35,500 revenue with ৳14,200 ad spend = 2.50x
      const roas2 = calculateROAS(35500, 14200);
      expect(roas2).toBe(2.5);

      // ৳12,000 revenue with ৳15,000 ad spend = 0.80x (unprofitable ad spend)
      const roas3 = calculateROAS(12000, 15000);
      expect(roas3).toBe(0.8);
    });

    it('should handle zero spend gracefully with fallback budget or 0', () => {
      // Zero spend and zero revenue
      expect(calculateROAS(0, 0)).toBe(0);

      // Zero spend with revenue and fallback budget ৳10,000
      expect(calculateROAS(30000, 0, 10000)).toBe(3);

      // Zero spend with revenue and no fallback budget
      expect(calculateROAS(30000, 0, 0)).toBe(0);
    });

    it('should handle zero revenue with positive ad spend as 0 ROAS', () => {
      expect(calculateROAS(0, 5000)).toBe(0);
    });
  });

  describe('3. Budget Limits & Validation Warnings (SAFE, WARNING, EXCEEDED)', () => {
    const budgetLimit = 50000;

    it('should mark budget as SAFE when spend is below 80%', () => {
      // ৳35,000 spend on ৳50,000 budget = 70%
      const evaluation = evaluateCampaignBudget(budgetLimit, 35000);
      expect(evaluation.status).toBe('SAFE');
      expect(evaluation.color).toBe('emerald');
      expect(evaluation.spendPercentage).toBe(70);
      expect(evaluation.isApproaching).toBe(false);
      expect(evaluation.isExceeded).toBe(false);
      expect(evaluation.warningMessage).toBeNull();
    });

    it('should trigger WARNING when spend approaches budget limit (80% - 100%)', () => {
      // ৳42,500 spend on ৳50,000 budget = 85%
      const evaluation1 = evaluateCampaignBudget(budgetLimit, 42500);
      expect(evaluation1.status).toBe('WARNING');
      expect(evaluation1.color).toBe('amber');
      expect(evaluation1.spendPercentage).toBe(85);
      expect(evaluation1.isApproaching).toBe(true);
      expect(evaluation1.isExceeded).toBe(false);
      expect(evaluation1.warningMessage).toContain('বাজেট প্রায় শেষ (85%)');
      expect(evaluation1.warningMessage).toContain('7,500');

      // Exactly 80% boundary
      const evaluation2 = evaluateCampaignBudget(budgetLimit, 40000);
      expect(evaluation2.status).toBe('WARNING');
      expect(evaluation2.spendPercentage).toBe(80);

      // Exactly 100% boundary
      const evaluation3 = evaluateCampaignBudget(budgetLimit, 50000);
      expect(evaluation3.status).toBe('WARNING');
      expect(evaluation3.spendPercentage).toBe(100);
      expect(evaluation3.isExceeded).toBe(false);
    });

    it('should trigger EXCEEDED when spend exceeds budget limit (> 100%)', () => {
      // ৳55,000 spend on ৳50,000 budget = 110%
      const evaluation = evaluateCampaignBudget(budgetLimit, 55000);
      expect(evaluation.status).toBe('EXCEEDED');
      expect(evaluation.color).toBe('rose');
      expect(evaluation.spendPercentage).toBe(110);
      expect(evaluation.isApproaching).toBe(false);
      expect(evaluation.isExceeded).toBe(true);
      expect(evaluation.warningMessage).toContain('বাজেট সীমা অতিক্রম করেছে (110%)');
      expect(evaluation.warningMessage).toContain('5,000');
    });

    it('should handle zero budget safely', () => {
      const evaluation = evaluateCampaignBudget(0, 1000);
      expect(evaluation.spendPercentage).toBe(0);
      expect(evaluation.status).toBe('SAFE');
    });
  });

  describe('4. Lead Revenue Aggregation & Campaign ROAS Integration', () => {
    it('aggregates converted leads with ORDERED status and positive order_amount', () => {
      // Mock leads tied to a campaign
      const campaignLeads = [
        { id: 'lead-1', status: 'NEW', order_amount: null, expected_value: 5000 },
        { id: 'lead-2', status: 'IN_PROGRESS', order_amount: null, expected_value: 12000 },
        { id: 'lead-3', status: 'ORDERED', order_amount: 15000, expected_value: 15000 },
        { id: 'lead-4', status: 'ORDERED', order_amount: 25000, expected_value: 20000 },
        { id: 'lead-5', status: 'LOST', order_amount: 0, expected_value: 8000 },
      ];

      // Exact aggregation logic used in GET /api/campaigns
      const orderedLeads = campaignLeads.filter(
        (l) => l.status === 'ORDERED' || (Number(l.order_amount) || 0) > 0
      );
      const ordersCount = orderedLeads.length;
      const revenue = orderedLeads.reduce(
        (sum, l) => sum + (Number(l.order_amount) || 0),
        0
      );

      expect(ordersCount).toBe(2);
      expect(revenue).toBe(40000); // 15000 + 25000

      // Campaign with ৳10,000 ad spend
      const campaignSpend = 10000;
      const roas = calculateROAS(revenue, campaignSpend);

      // ROAS = ৳40,000 / ৳10,000 = 4.00x
      expect(roas).toBe(4.0);
    });
  });
});
