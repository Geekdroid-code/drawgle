import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserCredits } from '@/lib/credits';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { requiredCredits = 1 } = await request.json();
    
    const { balance, error } = await getUserCredits(user.id);
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to check credits' },
        { status: 500 }
      );
    }

    const hasEnoughCredits = balance >= requiredCredits;
    
    return NextResponse.json({
      hasCredits: hasEnoughCredits,
      currentBalance: balance,
      requiredCredits
    });
    
  } catch (error) {
    console.error('Error checking credits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requiredCredits = parseInt(searchParams.get('requiredCredits') || '1');
    
    const { balance, error } = await getUserCredits(user.id);
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to check credits' },
        { status: 500 }
      );
    }

    const hasEnoughCredits = balance >= requiredCredits;
    
    return NextResponse.json({
      hasCredits: hasEnoughCredits,
      currentBalance: balance,
      requiredCredits
    });
    
  } catch (error) {
    console.error('Error checking credits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}