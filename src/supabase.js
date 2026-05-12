import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iynyzhiyddexvpxmodxi.supabase.co'
const supabaseKey = 'sb_publishable_Qi02bkrGxMHt2MBhVEMnMA_lNyuRtHj'

export const supabase = createClient(supabaseUrl, supabaseKey)