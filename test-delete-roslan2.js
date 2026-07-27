const req = {
    method: "POST",
    body: { username: "Roslan2", password: "@reeZ860", miwDate: "20-07-2026" }
};
const res = {
    setHeader: () => {},
    writeHead: () => {},
    write: (chunk) => console.log("WRITE:", chunk),
    end: () => console.log("END")
};
require("./api/delete-rph.js")(req, res);
