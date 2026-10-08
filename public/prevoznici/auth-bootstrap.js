(function(){'use strict';
 // Public project credentials. No team database adapter, subscriptions or admin queries.
 if(!window.supabase?.createClient){window.SCTransportStartupError='Prijava nije učitana. Osvežite stranicu.';return;}
 window.SCPartnerClient=window.supabase.createClient('https://qghrrnqsvsrcwdhgufkv.supabase.co','sb_publishable_ouwn1r_BvZS9nWyg3vJHAQ_ApUagfSP',{
  auth:{storageKey:'swiscars-partner-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}
 });
})();
