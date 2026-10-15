# 🐸 姜闻达回忆录 — 个人云端摄影相册网站

一个 “有网址即可浏览、仅管理员可上传” 的个人摄影相册。



* 前端：React + TypeScript + Vite + React Router

* 后端 / 云端：Supabase（Auth + PostgreSQL + Storage + RLS）

* 部署：Netlify

* 风格：搞笑杂志风（奶蛙 / 象牙白 / 浅米色 / 衬线标题 / 贴纸 / 颜文字）

四个相册：**LIFE 生活** · **CAMPUS 学校** · **FOOD 吃饭** · **TRAVEL 旅游**

> ⚠️ 
>
> **先读隐私说明**
>
> ：照片存储在 Supabase 的
>
> **公开可读 bucket**
>
>  中。任何拿到网址的人都能浏览，
> 而且
>
> **拿到某张图片直链的人也可能直接打开该图片**
>
> 。因此
>
> **不要上传**
>
> 你不希望被他人看到的照片、
> 证件、住址、账号、未成年人敏感画面等。照片一旦被他人转发，无法控制传播范围。



***

## 一、整体架构与数据流



```
访客/管理员 浏览器 (React SPA)
        │   仅携带 anon/public key（公开密钥）
        ▼
Supabase
 ├── Auth          邮箱密码登录（仅你一个管理员，关闭公开注册）
 ├── PostgreSQL    profiles / albums / photos / site_settings（RLS 强制权限）
 └── Storage       photos bucket（public 读；仅管理员写）
        ▲
管理员后台 /admin ── 上传：浏览器压缩+缩略图 → Storage 存图 → 数据库写元数据
公开页面 / 与 /album/* ── 读取：数据库查元数据 → getPublicUrl 展示图片
```



* **照片文件**存在 Storage，数据库 `photos` 只存路径（`storage_path` / `thumb_path`），不存大图。

* **所有共享数据都在云端**，刷新、换设备、重新部署后照片依旧存在；前端 localStorage 只用于 “记住登录状态”，不存任何照片。

* **安全边界在数据库与 Storage 策略（RLS）**，不是前端隐藏按钮。访客即使直接调用 API 也无法写入。

### 目录结构



```
jiang-wenda-album/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ netlify.toml              # Netlify SPA 重写（解决子页面刷新 404）
├─ .env.example
├─ .gitignore
├─ supabase/
│  └─ schema.sql             # 建表 + RLS + Storage 策略 + 初始数据
├─ public/
│  └─ favicon.svg
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ config/site.ts         # 文案 / 分类 / 上传限制（集中管理）
   ├─ context/AuthContext.tsx
   ├─ lib/
   │  ├─ supabase.ts         # Supabase 客户端
   │  ├─ types.ts
   │  ├─ api.ts              # 所有读写（读公开、写需管理员）
   │  └─ image.ts            # 压缩 / 缩略图 / 安全命名
   ├─ components/
   │  ├─ Layout.tsx  ConfigWarning.tsx
   │  ├─ SmartImage.tsx  PhotoGrid.tsx  Lightbox.tsx  PlaceholderCover.tsx
   ├─ pages/
   │  ├─ Home.tsx  AlbumPage.tsx
   └─ admin/
      ├─ Login.tsx  AdminRoute.tsx  AdminShell.tsx
      └─ AdminPhotos.tsx  AdminSettings.tsx
```



***

## 二、本地运行

### 1. 安装 Node.js

到 [https://nodejs.org](https://nodejs.org) 下载 **LTS 版（建议 20 或更高）**，安装后在终端验证：



```
node -v
npm -v
```

### 2. 安装依赖

在项目目录（`jiang-wenda-album`）内：



```
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env`，填入 Supabase 信息（见下一节如何获取）：



```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=你的-anon-或-publishable-key
```

> `.env`
>
>  已在 
>
> `.gitignore`
>
>  中，不会被提交。
>
> `.env.example`
>
>  里只放占位符。

### 4. 启动开发服务器



```
npm run dev
```

浏览器打开终端提示的地址（通常是 [http://localhost:5173](http://localhost:5173) ）。

### 5. 构建生产版本



```
npm run build      # 产物在 dist/
npm run preview    # 本地预览生产构建
```



***

## 三、创建并配置 Supabase（必须在平台手动操作）

> 以下步骤需要你登录 Supabase 控制台手动完成，脚本无法替你创建账号。



1. 打开 [https://supabase.com](https://supabase.com) ，用 GitHub 登录，**New project**，记下项目名、数据库密码、区域。

2. 等待项目初始化完成。

3. 进入 **Project Settings → API**：

* 复制 **Project URL**

* 复制 **anon / public** key（新版界面叫 **publishable key**，通常以 `sb_publishable_...` 开头）

* 把这两个值填进本地 `.env`。

* **绝对不要**复制 `service_role` / `secret` key 到前端。

1. 执行数据库脚本：

* 左侧 **SQL Editor → New query**

* 打开本仓库 `supabase/schema.sql`，**全选复制**粘贴进去，点 **Run**。

* 该脚本会：建表、建索引、开启 RLS、写入策略、创建 4 个相册、创建设置行、创建公开 `photos` bucket。

1. 验证 Storage：

* 左侧 **Storage**，应看到名为 **photos** 的 public bucket，里面有 `full/`、`thumb/`（上传后才出现）。

### 关闭公开注册（重要）



* 进入 **Authentication → Providers（或 Sign In / Providers → Email）**

* 关闭 **Allow new users to sign up / 公开注册**。

* 这样除了你在控制台手动创建的账号，任何人都无法注册。

### 创建并授权唯一管理员



1. 进入 **Authentication → Users → Add user → Create new user**。

2. 填写你本人邮箱 + 一个强密码，勾选 **Auto Confirm User**。

3. 回到 **SQL Editor**，执行（把邮箱换成你刚创建的）：



```
update public.profiles
   set is_admin = true
 where email = 'your-admin-email@example.com';
```



1. 可用下面语句确认只有一个管理员：



```
select email, is_admin from public.profiles where is_admin = true;
```

> 触发器会在你创建用户时自动生成 
>
> `is_admin=false`
>
>  的 profile；上面这条语句才把它提升为管理员。
> 前端没有任何入口能把自己设为管理员，相关写入被 RLS 拦截。



***

## 四、本地验证（部署前先做）



1. `npm run dev` 打开首页，应看到四个相册入口，数量都是 `0 张照片`。

2. 访问 `/login`，用管理员邮箱登录，进入 `/admin/photos`。

3. 上传几张照片到不同分类；刷新页面，照片仍在（证明已存云端）。

4. 回到首页，能看到真实数量、封面和 “最近上传”。

5. **退出登录**（或开一个无痕窗口），确认看不到任何上传 / 编辑 / 删除入口，且公开页正常。



***

## 五、部署到 Netlify

### 1. 把项目上传到 GitHub

在项目根目录：



```
git init
git add .
git commit -m "init: 姜闻达回忆录相册网站"
```

然后到 [https://github.com/new](https://github.com/new) 新建一个仓库（可设为 Private），按页面提示关联并推送：



```
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

> 提交前确认 
>
> `.env`
>
>  没有被加入（
>
> `.gitignore`
>
>  已排除）。
>
> `service_role`
>
>  key 绝不能进仓库。

### 2. 连接 Netlify



1. 登录 [https://app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**。

2. 选择 GitHub，授权并选中你的仓库。

3. 构建配置：

* **Build command**：`npm run build`

* **Publish directory**：`dist`

1. 展开 **Environment variables**，添加：

* `VITE_SUPABASE_URL` = 你的 Project URL

* `VITE_SUPABASE_ANON_KEY` = 你的 anon /publishable key

1. 点 **Deploy site**。

> 这些环境变量是在 
>
> **Netlify 构建时**
>
> 注入前端包的，使用的是公开 anon key；
> 网站部署后如果改了变量，需要 
>
> **Trigger rebuild**
>
> 。

### 3. 解决子页面刷新 404

仓库根目录已提供 `netlify.toml`，包含 SPA 重写：



```
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

因此 `/album/life` 等地址刷新不会 404。若你在 Netlify 手动设置，请确保存在等价的 SPA redirect。

### 4. 把 Netlify 域名加入 Supabase 白名单（可选但建议）



* **Authentication → URL Configuration → Site URL / Redirect URLs**，填入你的 Netlify 网址

  （如 `https://你的站点.netlify.app`）。

* Storage 公开图片不需要额外配置即可显示。

### 5. 部署后验证



* 打开线上网址：未登录可浏览四个相册与大图。

* 访问 `https://你的站点.netlify.app/login`，管理员登录、上传、刷新、换设备复测。

* 用无痕窗口验证访客无法管理（见测试清单）。

### 6. 排查部署问题



* **Netlify → 站点 → Deploys → 点进某次部署 → Deploy log** 查看构建日志。

* 白屏且提示未配置：环境变量没填或没重新构建。

* 登录后立刻被踢回 `/login`：该账号 `profiles.is_admin` 不是 true，或没执行授权 SQL。

* 能登录但上传报权限错误：`schema.sql` 没完整执行，或 Storage 策略缺失。

* 图片不显示：检查 Storage bucket `photos` 是否为 public、对象是否真的上传成功。



***

## 六、图片与上传说明



* 上传时浏览器先用 Canvas 压缩：大图长边压到 1920px、网格缩略图压到 600px，JPEG 质量 0.82；

  GIF 保留原图以维持动画。

* 网格使用 `thumb/` 缩略图，灯箱才加载 `full/` 大图；图片使用 `loading="lazy"`。

* 文件名采用 `full/年月日-时间戳-随机串.jpg`，避免重名覆盖与路径穿越。

* 限制：仅 JPG/PNG/WebP/GIF，单文件 ≤ 20MB（前端 + Storage bucket 双重限制）。

* 删除照片：先删数据库记录，再删 Storage 原图和缩略图；若 Storage 部分失败，后台会提示存在孤儿文件，

  可到 Supabase Storage 手动清理后重试。

* 公开 bucket 与受控写入的区别：


  * **公开读**：任何人可读取图片用于展示（满足 “有网址即可浏览”）。

  * **受控写**：只有管理员（认证 + `is_admin`）能上传 / 覆盖 / 删除；匿名写入被 Storage 策略拒绝。



***

## 七、测试清单

### A. 自动化 / 构建验证（本地可执行）



| #  | 项目      | 方式                  |
| -- | ------- | ------------------- |
| A1 | 依赖安装成功  | `npm install`       |
| A2 | 类型检查通过  | `npm run typecheck` |
| A3 | 生产构建成功  | `npm run build`     |
| A4 | 本地预览可打开 | `npm run preview`   |

> 说明：本仓库未内置单元测试框架，A 类为构建级验证；涉及 Supabase 云端权限的功能必须按 B 类手动测试。

### B. 部署后必须手动完成的测试



| #  | 测试场景         | 预期结果                                                 |
| -- | ------------ | ---------------------------------------------------- |
| 1  | 未登录访客打开首页    | 正常显示，无报错                                             |
| 2  | 未登录访客进入四个相册  | 四个 `/album/*` 均可浏览                                   |
| 3  | 未登录访客点开大图    | 灯箱可上一张 / 下一张 / 关闭、键盘方向键可用                            |
| 4  | 未登录访客尝试上传    | 无任何上传入口；直接调 API 也被 RLS 拒绝                            |
| 5  | 未登录访客尝试改信息   | 无法修改（无入口 + RLS 拒绝）                                   |
| 6  | 未登录访客尝试删除    | 无法删除（无入口 + RLS 拒绝）                                   |
| 7  | 管理员登录        | 正确账号可进入后台，错误密码有清晰提示                                  |
| 8  | 管理员一次上传多张    | 多选 / 拖拽上传成功，有缩略图与压缩                                  |
| 9  | 照片正确分类       | 进入对应相册可见                                             |
| 10 | 刷新页面照片仍在     | 数据来自云端                                               |
| 11 | 另一台设备打开同一网址  | 能看到相同云端照片                                            |
| 12 | 管理员修改标题 / 日期 | 保存后公开页更新                                             |
| 13 | 管理员删除照片      | 二次确认后删除，记录与 Storage 文件都清理                            |
| 14 | 删除后公开相册更新    | 数量与封面正确变化                                            |
| 15 | 手机端布局        | 导航、网格、灯箱按钮正常                                         |
| 16 | 空相册          | 显示默认占位，无破损图标                                         |
| 17 | 图片地址失效       | 显示友好占位，页面不崩溃                                         |
| 18 | 普通已登录用户      | 非管理员无法进入 `/admin`，无法写数据                              |
| 19 | 直接调用数据库 API  | 无 token 或非管理员 token 执行 insert/update/delete 全部返回权限错误 |
| 20 | 生产构建         | `npm run build` 成功并可部署                               |

### 如何做第 19 项的 “绕过前端” 验证（重要）



* **数据库**：用 anon key（未登录）在 Supabase 控制台 **API 文档 / Edge Functions 测试或任意 REST 客户端**

  对 `photos` / `albums` / `site_settings` 发 POST、PATCH、DELETE，应返回 `401/403` 或 “row-level security” 错误。

* **Storage**：未登录时对 `photos` bucket 调用 upload，应返回权限错误。

* **提权**：用一个非管理员账号登录后，尝试 `update profiles set is_admin=true where id=auth.uid()`，

  应被 `profiles_admin_update` 策略拒绝。



***

## 八、常见问题与维护



* **想改默认文案**：在 `/admin/settings` 改（存云端）；或改 `src/config/site.ts` 后重新部署。

* **忘记管理员密码**：Supabase 控制台 Authentication → Users → 对用户 **Reset password**。

* **想增加第二个管理员**：控制台创建用户并执行同样的 `update profiles set is_admin=true ...`（最小授权原则，不建议随意添加）。

* **想彻底私有化**：当前需求是 “有网址即可浏览”，故用 public bucket；若以后要私密，需要把 bucket 改为私有并引入签名 URL，

  属于另一种架构，届时再调整。



***

## 九、安全注意事项（再次强调）



1. 前端只放 `VITE_SUPABASE_URL` 和 anon/publishable key，这些是公开密钥，安全靠 RLS。

2. **永远不要**把 `service_role` key、数据库密码、管理员密码放进前端或 GitHub。

3. 关闭公开注册，只授权你本人一个管理员。

4. 不要在公开相册上传敏感、隐私或不宜公开传播的内容。