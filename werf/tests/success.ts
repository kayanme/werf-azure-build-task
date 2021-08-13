import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'index.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('command', 'converge');
tmr.setInput('arguments', '');
tmr.setInput('containerRegistryType', 'Container Registry');
tmr.setInput('dockerRegistryEndpoint', 'Innopolis Docker Registry');

tmr.run();