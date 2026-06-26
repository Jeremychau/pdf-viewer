const path = require('path');
const express = require('express');

const app = express();

const rootDir = __dirname;

app.use('/pdf', express.static(path.join(rootDir, 'pdf')));

app.get('/', (req, res) => {
    res.sendFile(path.join(rootDir, 'index.html'));
});

const port = 3412;
app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log('Server listening on http://localhost:' + port);
});

