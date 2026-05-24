import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Database } from '@/lib/supabase/database.types'
import { SupabaseClient } from '@supabase/supabase-js'

type Credits = {
  id?: string
  user_id: string
  credits: number
  created_at?: string
  updated_at?: string
}
type CreditsInsert = Credits
type CreditsUpdate = Partial<Credits>

export class CreditService {
  private customClient?: any

  constructor(client?: any) {
    this.customClient = client
  }

  private async getClient() {
    // Use custom client if provided (e.g., admin client for background jobs)
    if (this.customClient) {
      return this.customClient
    }
    // Otherwise use the server client (requires auth context)
    return await createClient()
  }

  /**
   * Get user's current credit balance
   */
  async getUserCredits(userId: string): Promise<{ balance: number; error?: string }> {
    try {
      if (!userId) {
        return { balance: 0, error: 'Invalid user ID' }
      }

      const supabase = await this.getClient()
      const { data, error } = await supabase
        .from('credits')
        .select('credits')
        .eq('user_id', userId)
        .single() as { data: Credits | null; error: any }

      if (error && error.code !== 'PGRST116') {
        return { balance: 0, error: 'Failed to fetch credits' }
      }

      if (!data) {
        await this.initializeUserCredits(userId)
        return { balance: 0 }
      }

      return { balance: Number(data.credits) || 0 }
    } catch (error) {
      return { balance: 0, error: 'Error fetching credits' }
    }
  }

  /**
   * Add credits to user's account
   */
  async addCredits(
    userId: string,
    amount: number,
    description: string = 'Credits added'
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
      if (!userId || amount <= 0) {
        return { success: false, error: 'Invalid parameters' }
      }

      const { balance: currentBalance } = await this.getUserCredits(userId)
      const newBalance = currentBalance + amount

      const supabase = await this.getClient()
      const creditData: CreditsInsert = {
        user_id: userId,
        credits: newBalance
      }
      const { error } = await supabase
        .from('credits')
        .upsert(creditData, {
          onConflict: 'user_id'
        })

      if (error) {
        return { success: false, error: 'Failed to add credits' }
      }

      return { success: true, newBalance }
    } catch (error) {
      return { success: false, error: 'Error adding credits' }
    }
  }

  /**
   * Deduct credits from user's account
   */
  async deductCredits(
    userId: string,
    amount: number,
    description: string = 'Credits used'
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
      if (!userId || amount <= 0) {
        return { success: false, error: 'Invalid parameters' }
      }

      const { balance: currentBalance } = await this.getUserCredits(userId)

      if (currentBalance < amount) {
        return { success: false, error: 'Insufficient credits' }
      }

      const newBalance = currentBalance - amount

      const supabase = await this.getClient()
      const updateData: CreditsUpdate = { credits: newBalance }
      const { error } = await supabase
        .from('credits')
        .update(updateData)
        .eq('user_id', userId)

      if (error) {
        return { success: false, error: 'Failed to deduct credits' }
      }

      return { success: true, newBalance }
    } catch (error) {
      return { success: false, error: 'Error deducting credits' }
    }
  }

  /**
   * Set user's credit balance to an absolute value
   */
  async setCredits(
    userId: string,
    value: number,
    description: string = 'Credits set'
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
      if (!userId || value < 0) {
        return { success: false, error: 'Invalid parameters' }
      }

      const supabase = await this.getClient()
      const upsertData: CreditsInsert = {
        user_id: userId,
        credits: value
      }

      const { error } = await supabase
        .from('credits')
        .upsert(upsertData, { onConflict: 'user_id' })

      if (error) {
        return { success: false, error: 'Failed to set credits' }
      }

      return { success: true, newBalance: value }
    } catch (error) {
      return { success: false, error: 'Error setting credits' }
    }
  }

  /**
   * Check if user has sufficient credits
   */
  async hasCredits(userId: string, requiredAmount: number): Promise<{ hasCredits: boolean; currentBalance: number; error?: string }> {
    const { balance, error } = await this.getUserCredits(userId)
    return {
      hasCredits: balance >= requiredAmount,
      currentBalance: balance,
      error
    }
  }

  /**
   * Initialize credits for a new user (grants FREE_TIER_CREDITS by default)
   */
  async initializeUserCredits(
    userId: string,
    initialCredits: number = 0  // Default: 0 free credits for new users to enforce subscription plans
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await this.getClient()
      const creditData: CreditsInsert = {
        user_id: userId,
        credits: initialCredits
      }
      const { error } = await supabase
        .from('credits')
        .insert(creditData)

      if (error && error.code !== '23505') {
        return { success: false, error: 'Failed to initialize credits' }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Error initializing credits' }
    }
  }
}

// Export a singleton instance for server-side use with auth context
export const creditService = new CreditService()

// Export admin service for background jobs (no auth context needed)
export const adminCreditService = new CreditService(createAdminClient())

// Helper functions using server client (require auth context)
export async function getUserCredits(userId: string) {
  return creditService.getUserCredits(userId)
}

export async function addCredits(userId: string, amount: number, description?: string) {
  return creditService.addCredits(userId, amount, description)
}

export async function setCredits(userId: string, value: number, description?: string) {
  return creditService.setCredits(userId, value, description)
}

export async function deductCredits(userId: string, amount: number, description?: string) {
  return creditService.deductCredits(userId, amount, description)
}

export async function hasCredits(userId: string, requiredAmount: number) {
  return creditService.hasCredits(userId, requiredAmount)
}

// Admin helper functions for background jobs (no auth context needed)
export async function adminHasCredits(userId: string, requiredAmount: number) {
  return adminCreditService.hasCredits(userId, requiredAmount)
}

export async function adminDeductCredits(userId: string, amount: number, description?: string) {
  return adminCreditService.deductCredits(userId, amount, description)
}

export async function adminAddCredits(userId: string, amount: number, description?: string) {
  return adminCreditService.addCredits(userId, amount, description)
}