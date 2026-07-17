const SUPABASE_URL = "https://bgybaskntgqxumuayoti.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJneWJhc2tudGdxeHVtdWF5b3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyOTEzMDMsImV4cCI6MjA5OTg2NzMwM30.-ENaxMEQ5AbIidECJLtT_RUybqjxqgTAMRitF68RzXc";

// 이름을 'supabase'로 그대로 쓰면 CDN이 전역에 심어둔 var supabase와 충돌해서
// SyntaxError가 나고 이후 스크립트가 전부 실행되지 않는다. 반드시 다른 이름을 사용한다.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
