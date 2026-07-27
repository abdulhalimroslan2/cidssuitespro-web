async function test() {
  const params = new URLSearchParams({ username: "Roslan2", password: "@reeZ860", redirect: "main.php?cb=ms", language: "en", view: "home", submit: "Login" });
  const res1 = await fetch("https://asiemodel.net/model/index.php?exp=1&redirect=main.php%3Fcb%3Dms", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" },
    body: params.toString(),
    redirect: "manual"
  });
  const cookies = res1.headers.getSetCookie();
  const sess = cookies[0].match(/PHPSESSID=([^;]+)/)[1];
  console.log("PHPSESSID:", sess);

  const res2 = await fetch("https://asiemodel.net/model/search9.php?action=search_yearly", {
    headers: { "Cookie": "PHPSESSID=" + sess, "User-Agent": "Mozilla/5.0" }
  });
  const html = await res2.text();
  console.log("HTML length:", html.length);

  const allLinks = [...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const rpts = [];
  for (const m of allLinks) {
    if (m[1].includes("create_rpt") || m[1].includes("rpt9.php") || m[1].includes("rpt.php")) {
      let t = m[2].replace(/<[^>]+>/g, "").trim();
      rpts.push({ title: t || "RPT", url: m[1] });
    }
  }
  console.log("RPT Count:", rpts.length);
  console.log("Sample RPTs:", rpts.slice(0, 5));
}
test();
