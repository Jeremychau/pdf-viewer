const path = require('path');
const express = require('express');

const app = express();

const rootDir = __dirname; // new_src/

app.use('/pdf', express.static(path.join(rootDir, 'pdf')));

app.get('/', function (req, res) {
    res.sendFile(path.join(rootDir, 'index.html'));
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3412;
app.listen(port, function () {
    // eslint-disable-next-line no-console
    console.log('Server listening on http://localhost:' + port);
});

