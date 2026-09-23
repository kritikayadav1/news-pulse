# Kritika, yahan se start karo

Ye Xponentium ke News Pulse assessment ka complete source project hai: Python scraper + Node.js API + React frontend. Next.js seekhna zaroori nahi; assessment React allow karta hai.

## 1. Laptop par kya chahiye?

- Node.js **24 ya newer**: https://nodejs.org/en/download
- Python **3.11 ya newer**; 3.12 par verify kiya gaya hai: https://www.python.org/downloads/
- VS Code.

Python install karte waqt **Add Python to PATH** select karo. Install ke baad VS Code dobara kholo.

VS Code terminal (PowerShell) mein check karo:

```powershell
node --version
npm.cmd --version
py --version
```

`py` nahi chale toh `python --version` try karo.

## 2. Project open karo

Updated ZIP ko **naye folder** mein extract karo. Purana project abhi rakh sakti ho. Purana dev server `Ctrl+C` se stop karo. VS Code > File > Open Folder > naye folder ka **news-pulse** select karo. Wahi folder jahan root `package.json` aur `START_HERE_HINGLISH.md` hain.

Terminal > New Terminal kholo. Commands ek-ek karke chalao:

```powershell
npm.cmd ci
npm.cmd run setup
npm.cmd run ingest
npm.cmd run dev
```

- `npm.cmd ci`: JavaScript packages install karega.
- `npm.cmd run setup`: Python environment, `feedparser` aur baaki packages, aur `.env` file banayega. Activation manually karne ki zaroorat nahi. **Setup complete** aane ke baad next command chalao.
- `npm.cmd run ingest`: pehli baar real news collect karega; network ke hisaab se kuch minutes lag sakte hain.
- `npm.cmd run dev`: Node backend aur React frontend dono chalayega. Python ka separate server start nahi karna.

Browser mein **http://localhost:5173** kholo. Terminal band mat karo.

## 3. Real news collect karo

Upar `ingest` successful tha toh Headlines page par news dikhegi. Baad mein app ka **Refresh** button dabakar news update karo; progress app mein dikhega. Collection fail ho toh asli error terminal/app mein padho; sirf baar-baar refresh mat dabao.

News collect hone par:

1. **Headlines** par featured photo aur news cards dekho; dots se featured story badlo.
2. Search ya category select karo. Categories headline/keywords se estimate hoti hain; har category mein news hona zaroori nahi.
3. Koi headline kholo: **Topic timeline** par uski coverage aayegi. **Compare sources** se outlets ki headlines/summaries saath dekho.
4. Article ka bookmark button dabao, phir header mein **Saved** kholo. Ye isi browser mein save hota hai.
5. Moon/sun button se dark/light mode try karo.
6. BBC / The Guardian / NPR toggle karo; Past 3 days ko Past 7 days karke dekho.
7. Detail mein original article headline par click karke publisher page kholo.

Har row ek topic hai. Blue bar us topic ke pehle aur latest article ka time span hai. Sirf ek timestamp ho toh dot hai. Number article count hai.

**Sample preview ko real news samajhkar submit mat karna.** Sample mode sirf offline UI practice ke liye hai. Real feeds ke bina live-news requirement complete nahi hogi.

## 4. Sabse pehle kya samjho?

Is order mein files padho:

| File                   | Simple meaning                                              |
| ---------------------- | ----------------------------------------------------------- |
| `shared/sources.json`  | Kaunse 3 sources se news leni hai                           |
| `scraper/ingestion.py` | Feed read, fields clean, date normalize, article text fetch |
| `scraper/grouping.py`  | Common meaningful words se related news ka group            |
| `scraper/main.py`      | Scrape → extract → group → database save                    |
| `backend/src/app.js`   | Frontend ko data dene wale API routes                       |
| `backend/src/jobs.js`  | Refresh click hone par Python chalana, progress save karna  |
| `frontend/src/App.jsx` | Homepage, timeline, comparison, saved articles aur theme    |

Python mein pehle functions, lists, dictionaries, loops, sets aur `try/except` samjho. Is project ko samajhne ke liye pehle poora Python course finish karna zaroori nahi.

## 5. Clustering ka simple example

Headline A: “Lunar mission scientists launch orbital research telescope”

Headline B: “Scientists launch research telescope for lunar mission”

Dono mein `lunar`, `mission`, `scientists`, `launch`, `research`, `telescope` common hain.

Code pehle `the`, `is`, `and` jaise common words hata deta hai. Phir:

- Kam se kam **3 meaningful words common** hone chahiye.
- Jaccard similarity = **common words / total unique words**, kam se kam **0.25**. Headline-only aur headline+summary ke scores mein se higher score lete hain, taaki alag summary wording matching headlines ko dilute na kare.
- Headlines ka bhi kam se kam ek meaningful word common ho.
- Articles ek **72-hour window** mein hon.

Har naye article ko group ke first/anchor article se compare karte hain. Isliye ek beech ka article bahut alag stories ko chain ki tarah jod nahi deta. Ye heuristic hai, perfect understanding/AI nahi.

## 6. Tests aur production build

Dev server ke saath ek NEW terminal mein:

```powershell
npm.cmd test
npm.cmd run build
```

Production version dekhne ke liye pehle dev terminal mein `Ctrl+C`, phir:

```powershell
npm.cmd start
```

Ab **http://localhost:3001** par React app aur API dono milenge.

## 7. Agar error aaye

- **npm.ps1 cannot be loaded:** same commands mein `npm` ki jagah `npm.cmd` use karo. Example: `npm.cmd ci`. PowerShell security policy change karna zaroori nahi.
- **Please install Node.js 24 or newer:** Node.js 24+ install karo, saare VS Code windows close karke dobara kholo. `node --version` mein 24 ya newer hona chahiye; phir `npm.cmd run setup` chalao.
- **No module named feedparser:** `npm.cmd run setup` successfully complete nahi hua. Pehle Node version fix karo, phir setup dobara chalao. Setup complete hone ke baad `npm.cmd run ingest` chalao. Sirf global `pip install` karna project ke Python environment ko fix nahi karega.
- **Python not found:** Python install/PATH check karo, VS Code restart karo, `npm.cmd run setup` dobara chalao.
- **Port already in use:** purana dev terminal `Ctrl+C` se stop karo. Do servers ek hi port par mat chalao.
- **All feeds unavailable:** internet check karo. `.env` mein `REQUEST_TIMEOUT_SECONDS=25` try kar sakte ho. Dev server restart karke refresh karo. VPN, proxy ya company network news feeds ko block kar sakta hai.
- **Full text unavailable:** kuch publishers automated access rok sakte hain. App summary rakhkar continue karta hai; ye expected fallback hai.
- **Please wait before refreshing:** 60-second cooldown hai. Button available hone ka wait karo; pehle se dikh rahe collection error ko bhi resolve karo.
- **No photo on some cards:** publisher image missing/blocked ho sakti hai. Fallback normal hai; article phir bhi khul sakta hai.
- **Blank view:** kam se kam ek source on rakho, All stories select karo, search clear karo aur time range badhao. Collection notes padho.
- **Database URL error:** local run ke liye `.env` mein `DATABASE_URL=` blank rehne do. SQLite automatically kaam karega.

## 8. Fresh project ke 30 commits

`Create_NewsPulse_30_Commits.mjs` isi folder mein included hai. Git installed hona chahiye (`git --version`). Ye helper tumhare requested **9 February–30 April 2026** dates par 30 commits banata hai, dates ke beech **2–4 din ka gap** hai. Dates selected historical timestamps hain; existing source snapshot ko file groups mein commit kiya jaata hai. Early commits mein app incomplete ho sakti hai; last commit mein complete source hota hai.

Fresh extracted folder mein, `git init` chalaye bina:

```powershell
node .\Create_NewsPulse_30_Commits.mjs --plan
node .\Create_NewsPulse_30_Commits.mjs
```

Apna naam aur GitHub account se linked email (ya GitHub noreply email) enter karo. Verify:

```powershell
git rev-list --count HEAD
git log --reverse --format="%ad %s" --date=short
```

Count **30** aana chahiye. GitHub par new **empty** repository banao; README, license aur .gitignore select mat karo. Uska HTTPS URL copy karo, phir:

```powershell
$newsPulseRepoUrl = Read-Host "Paste your new GitHub repository HTTPS URL"
git remote add origin $newsPulseRepoUrl
git push -u origin main
```

Helper push khud nahi karta. Existing Git repo mile toh safely rukta hai; fresh extracted folder use karo. Is helper ki apni file local history se excluded hoti hai; `.env`, database aur installed packages bhi upload nahi hote.

## 9. Submission se pehle

1. Project run karke code samjho. Jo explain nahi hota, use pehle samjho/change karo.
2. `docs/DEPLOYMENT.md` follow karke live deploy karo.
3. Apne GitHub par code push karo. `.env`, `.venv`, `node_modules` ya local database upload mat karna.
4. `docs/VIDEO_SCRIPT.md` follow karke apni 2–3 minute recording karo.
5. Live frontend URL, API URL, GitHub URL aur video URL submission mein do.

**Abhi ZIP code deliverable hai. GitHub upload, live hosting aur tumhari recording separate steps hain.** Accounts ki login information chat mein share mat karo; provider ki apni sign-in screen use karo.
