# NoLang Skill (Claude Code / Codex plugin · MCP connector)
[English](README.md) | 日本語

**[NoLang](https://no-lang.com)** は動画生成 AI のサービスです。作りたい動画を言葉で伝えると、台本・ナレーション・絵・BGM のそろった動画ができます。このプラグインを入れると、Claude Code や Codex に動画を頼んで、見るためのリンクを受け取れます。

1. 下の「入れる」のコマンド 1 行でプラグインを入れ、Claude Code / Codex を起動し直します。
2. 「動画生成 AI の NoLang でできることを 60 秒で紹介する動画を作って」のように頼みます。
3. 初回はブラウザで NoLang へのログインを求められます。NoLang のアカウントが要りますが、その画面で作れます (プランと料金: https://no-lang.com/pricing )。1〜2 分で視聴用のリンクが出て、動画は NoLang のアカウントに残ります。

**NoLang Skill** は NoLang を AI エージェントから使う 2 つの方法 (このプラグインと MCP コネクタ) の総称です。このリポジトリはプラグインを配っています (Apache-2.0)。

使い方は AI ツールで決まります。1 つの AI ツールにはプラグインか MCP コネクタのどちらか 1 つを入れます。

| AI ツール | 使い方 |
|---|---|
| Claude Code | プラグイン |
| Codex (CLI・Codex のアプリ・ChatGPT のデスクトップアプリの中の Codex。IDE 拡張ではプラグインを使えません) | プラグイン |
| Claude のデスクトップアプリ (Code タブ・Cowork) | プラグイン (Claude Code の CLI も入れるのがおすすめ) |
| claude.ai・ChatGPT のアプリ・Gemini・Cursor などその他 | MCP コネクタ `https://api.no-lang.com/agent/mcp` |

## 入れる (1 回だけ)

プラグインには **Node.js 20 以上** が要ります (Claude Code には入っていないので、[nodejs.org](https://nodejs.org/) から別に入れます)。MCP コネクタは何も入れず、アプリに追加するだけで使えます。

一番簡単なのは、エージェントに「NoLang のプラグインを入れて (mvrks-inc/nolang-plugin)」と頼むことです。エージェントは末尾の「エージェントが入れる時の手順」に従います。自分で入れる時は次のとおりです。

**Claude Code** (端末で 1 行)

```
claude plugin install nolang --marketplace mvrks-inc/nolang-plugin
```

Claude Code の中なら `/plugin marketplace add mvrks-inc/nolang-plugin` と `/plugin install nolang@nolang` でも入ります。

**自動更新を on にする** (おすすめ): Claude Code は第三者の配布元のプラグインを、頼まれない限り更新しません。Claude Code で `/plugin` → Marketplaces → `nolang` → Enable auto-update を選びます。on にすると新しいバージョンが自動で届き、次の session から使われます。

**Claude のデスクトップアプリ (Code タブ)**: Code タブの Claude に上のように頼み、新しい session を開きます。Claude Code の CLI も入れて 1 回ログインしておくのがおすすめです。CLI があると、動画の再生が早く始まります。端末で次のコマンドを実行して CLI を入れ、`claude` を 1 回起動して claude.ai のアカウントでログインします。

```
curl -fsSL https://claude.ai/install.sh | bash        # macOS / Linux / WSL
irm https://claude.ai/install.ps1 | iex               # Windows PowerShell
```

CLI を入れた後なら、上の Claude Code の 1 行でもデスクトップアプリに入ります (デスクトップアプリも同じ設定を読みます)。

**Cowork**: Cowork の中のエージェントはプラグインを入れられません。Customize → Plugins → Add marketplace に `mvrks-inc/nolang-plugin` を入力し、`nolang` を install します (有料 plan)。Cowork は既定で他のドメインへの通信を止めるので、Settings → Capabilities の許可するドメインに `api.no-lang.com` と `no-lang.com` を足します (Team / Enterprise では管理者が設定します)。

**Codex**

```
codex plugin marketplace add mvrks-inc/nolang-plugin
codex plugin add nolang@nolang
```

Codex の中の `/plugins` → Add Marketplace でも入ります。入れたら起動し直します (Claude Code は `/reload-plugins` でもかまいません)。

### 前提と制限

- プラグインは自分の Claude Code か Codex に台本を書かせます。Claude Code は claude.ai の契約でログインしている必要があります。API キーだけ、Bedrock、Vertex の構成の時と、`claude` / `codex` のコマンドが使えない時は、プラグインが代わりに、その session の AI に原稿を書かせます。
- 会社の HTTP proxy には対応していません。
- プラグインは起動のたびに `api.no-lang.com` からプログラムの本体を取得し、署名を確かめてから動かします。署名の無いものと、署名の合わないものは動かしません。
- 動画を作る間の決まった操作 (状態の確認、原稿の書き込みなど) と、アカウントの確認、NoLang の素材とテンプレートの検索は、プラグインが確認なしで進めます。手元のファイルを送る操作などは、これまでどおり Claude Code の許可の確認が出ます。
- 質問・不具合は https://github.com/mvrks-inc/nolang-plugin/issues に issue を作ってください。エージェントに「nolang doctor を実行して」と頼んだ結果か、視聴 URL を添えてください。

## ログインする (1 回だけ)

Claude Code に「NoLang にログインして」と頼みます (頼まなくても、初めて動画を頼んだ時に聞かれます)。許可の URL が出るので (同じ機械ならブラウザも開きます)、NoLang にログインして「許可」を押し、Claude Code に「許可した」と返します。SSH やリモートの環境では、表示された URL とコードをブラウザで入力して許可します。ログインは 30 日使わなければ切れます。

claude.ai などの MCP コネクタを使うアプリでは、コネクタに `https://api.no-lang.com/agent/mcp` を足して接続する時にログインします。

## 頼む

```
動画生成 AI の NoLang でできることを 60 秒で紹介する動画を作って
この写真 (~/Desktop/product.png) を背景にして、新商品の紹介動画を縦長で作って
落ち着いた女性の声とピアノの BGM で、在宅勤務のコツを解説する動画を作って
```

- 1〜2 分で視聴 URL が出ます。Claude Code ではエージェントの返事より先に、通知にもリンクが出ます。生成中から再生でき、続きは見ている間に伸びます。Claude Code では、動画が完成した時にもエージェントが知らせます。
- 縦長にしたい時や長さを決めたい時は、そう言えばそのとおりになります。言わなければ 16:9 になり、長さは内容に合わせて決まります。動画は頼んだ言葉の言語で作られます (英語で頼めば英語の動画になります。別の言語にしたい時は「英語で」のように書きます)。
- 手元の写真・動画は自分の素材として送られて動画に入ります。声・BGM・効果音・書体は説明文から選ばれます (自分で決めたい時は「〇〇な声の候補を探して」と頼みます)。
- NoLang のテンプレートの形で作りたい時は、「商品紹介のテンプレートを探して、それで作って」のように頼みます。自分の動画の URL を添えて「この動画みたいに作って」と頼んでも同じです。
- 完成した mp4 が欲しい時は「完成したら mp4 のリンクをちょうだい」と頼みます。「この動画のここを直して」と頼むと、元の動画を残したまま、直した動画が作られます。

### 困った時

| 症状 | どうする |
|---|---|
| ログインの URL を開くのが遅れた | 待ち受けは案内に書かれた時間まで続く。過ぎたらもう一度「NoLang にログインして」と頼む |
| 「claude が無い」「codex が無い」と言われる | 何もしなくてよい。プラグインが代わりに、この session の AI に原稿を書かせて作る。デスクトップアプリでは Claude Code の CLI を入れる (上の「入れる」) と次から早く始まる |
| つながらない・様子がおかしい | 「nolang doctor を実行して」と頼み、結果を添えて issue を作る (https://github.com/mvrks-inc/nolang-plugin/issues) |
| 生成が失敗する・声が出ない | 原因はサーバー側にあることが多い。視聴 URL を添えて issue を作る |
| 同時に作れる動画の数の上限と言われる | 前の動画の完成を待つ (同時に生成できる本数はプランで決まる) |

## 更新する

プログラムの本体は NoLang の server が配り、プラグインが起動のたびに最新のものを取得します。普段は何もしなくてかまいません。

プラグイン自体は、自動更新を on にしていれば (「入れる」参照)、Claude Code が自動で更新し、次の session から新しいバージョンが使われます。on にしていなければ、新しいバージョンがある時に、動画のリンクなどの案内に更新のコマンドが 1 日 1 回添えられます。手で更新するには、次のコマンドを実行します。

```
claude plugin marketplace update nolang
claude plugin update nolang@nolang
```

続けて Claude Code を起動し直すか、`/reload-plugins` を実行します。ログインは残ります。Codex では `codex plugin marketplace upgrade nolang` → `codex plugin remove nolang@nolang` → `codex plugin add nolang@nolang` の順に実行し、起動し直します。

## エージェントが入れる時の手順

「NoLang のプラグインを入れて」と頼まれた AI エージェント向けの手順です。コマンドは 1 つずつ素のコマンドで実行し、最後に利用者がすることを伝えます。

1. `claude` コマンドがある Claude Code (端末、または CLI を入れたデスクトップアプリ): `claude plugin install nolang --marketplace mvrks-inc/nolang-plugin` を実行します。入れると利用者の設定 `~/.claude/settings.json` (Windows は `%USERPROFILE%\.claude\settings.json`) に `extraKnownMarketplaces.nolang` が書かれるので、他の中身は残したまま、その中の `source` の隣に `"autoUpdate": true` を足します (自動更新が on になります)。続けて、利用者に `/reload-plugins` か新しい session を頼みます。
2. `claude` コマンドが無いデスクトップアプリの Code タブ: 利用者の設定 `~/.claude/settings.json` (Windows は `%USERPROFILE%\.claude\settings.json`) に、自動更新を on にする次の 2 つの key を足します。file の他の中身は残し、file が無ければ作ります。次の session の開始時に Claude Code がプラグインを取得するので、利用者に新しい session を開いてもらいます。続けて、Claude Code の CLI も入れるかを利用者に尋ねます (入れるのがおすすめです。理由は上の「入れる」にあります)。入れると答えたら `curl -fsSL https://claude.ai/install.sh | bash` (Windows PowerShell では `irm https://claude.ai/install.ps1 | iex`) を実行し、新しい session を開く前に、ターミナルで `claude` を 1 回起動して claude.ai のアカウントでログインしてもらいます。

   ```json
   {
     "extraKnownMarketplaces": { "nolang": { "source": { "source": "github", "repo": "mvrks-inc/nolang-plugin" }, "autoUpdate": true } },
     "enabledPlugins": { "nolang@nolang": true }
   }
   ```
3. Codex: `codex plugin marketplace add mvrks-inc/nolang-plugin` → `codex plugin add nolang@nolang` の順に実行し、利用者に新しい session を頼みます。
4. Cowork・claude.ai・その他のアプリ: エージェントは自分では入れられません。Cowork なら上の「入れる」の手順を、プラグインの無いアプリなら MCP コネクタの URL `https://api.no-lang.com/agent/mcp` を利用者に伝えます。
5. `node` が無い (`node --version` が失敗するか 20 未満): 最初の動画の前に、https://nodejs.org/ (かパッケージマネージャー) で Node.js 20 以上を入れてもらいます。
