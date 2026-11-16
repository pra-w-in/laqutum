"""Local-only UI review with an isolated fixture account; never deploy this server.
Open /__preview for fixture data or / for the real sign-in screen.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

os.chdir(Path(__file__).resolve().parent.parent)
FIXTURE = """<script>
const CONTENT_BANK_URL = '/content-bank.json';
const previewUser = {id:'design-preview',name:'Alex',xp:120,streak:3,hearts:5,hasCompletedDiagnostic:true,isAdmin:true,unlockedTopics:['*'],confidenceStates:{},topicProgress:{}};
const AuthManager = {getCurrentUserSync:()=>previewUser,getCurrentUser:async()=>previewUser,updateCurrentUser:async()=>previewUser,openAuthModal:()=>{},logOut:()=>location.assign('/')};
window.supabaseClient = {
 auth:{getSession:async()=>({data:{session:null}})},
 from(table){
  const profile={user_id:'design-preview',display_name:'Alex',college:'Your study circle',year:'3rd Year',interests:['Aptitude','Placements'],xp_earned:120,avatar_emoji:'A'};
  const q={select:()=>q,eq:()=>q,neq:()=>q,or:()=>q,order:()=>q,limit:()=>q,in:()=>q,
    maybeSingle:async()=>({data:table==='socio_profiles'?profile:null,error:null}),
    single:async()=>({data:profile,error:null}),
    then:(resolve)=>Promise.resolve({data:[],error:null}).then(resolve),
    update:()=>q,upsert:()=>q,insert:()=>q,delete:()=>q}; return q;
 },
 channel(){const c={on:()=>c,subscribe:(callback)=>{if(callback)callback('SUBSCRIBED');return c;},send:async()=>{},unsubscribe:()=>{}};return c;},removeChannel:()=>{}
};
document.addEventListener('DOMContentLoaded',()=>PreviewApp.open());
</script>"""

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        if self.path.split('?')[0] == '/__preview':
            html = Path('index.html').read_text(encoding='utf8')
            html = html.replace('<script src="supabase.min.js?v=20261017-light2"></script>', FIXTURE)
            for script in ['supabase-config.js', 'auth.js']:
                html = html.replace(f'<script src="{script}?v=20261017-light2"></script>', '')
            raw = html.encode('utf8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
        else:
            super().do_GET()

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 8080), Handler).serve_forever()
