"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib");
//import download=require('azure-pipelines-tasks-utility-common/downloadutility')
const toolLib = require("azure-pipelines-tool-lib/tool");
const handlers = __importStar(require("typed-rest-client/Handlers"));
const path = require("path");
const fs = require("fs");
const acrauthenticationtokenprovider = require("azure-pipelines-tasks-docker-common-v2/registryauthenticationprovider/acrauthenticationtokenprovider");
const genericauthenticationtokenprovider = require("azure-pipelines-tasks-docker-common-v2/registryauthenticationprovider/genericauthenticationtokenprovider");
const os = require("os");
var userDir = getNewUserDirPath();
run();
function addConvergeCommandArgs(commandToExecute) {
    var setDockerConfig = tl.getBoolInput("sendDockerConfigToChart", true);
    if (setDockerConfig) {
        commandToExecute.arg("--set-docker-config-json-value=true");
    }
    commandToExecute.arg("--home-dir=" + userDir);
    var dockerPath = downloadDockerConfigFromEndpoint();
    fs.chmodSync(dockerPath + "/config.json", "777");
    commandToExecute.arg("--docker-config=" + dockerPath);
    var dockerServer = getDockerServerName();
    commandToExecute.arg("--repo=" + dockerServer + "/" + (tl.getInput("layerRepo", true)));
    var registryType;
    if (tl.getInput("containerRegistryType", true) == 'Azure Container Registry') {
        registryType = "acr";
    }
    else {
        registryType = "default";
    }
    commandToExecute.arg("--repo-container-registry=" + registryType);
    if (tl.getInput("namespace") != undefined) {
        commandToExecute.arg("--namespace=" + tl.getInput("namespace"));
    }
    var kubeConfigPath = downloadKubeconfigFileFromEndpoint();
    fs.chmodSync(kubeConfigPath, "777");
    commandToExecute.arg("--kube-config=" + kubeConfigPath + "");
}
function addDismissCommandArgs(commandToExecute) {
    var dockerPath = downloadDockerConfigFromEndpoint();
    fs.chmodSync(dockerPath + "/config.json", "777");
    commandToExecute.arg("--home-dir=" + userDir);
    commandToExecute.arg("--docker-config=" + dockerPath);
    var dockerServer = getDockerServerName();
    commandToExecute.arg("--repo=" + dockerServer + (tl.getInput("layerRepo", true)));
    var registryType;
    if (tl.getInput("containerRegistryType", true) == 'Azure Container Registry') {
        registryType = "acr";
    }
    else {
        registryType = "default";
    }
    commandToExecute.arg("--repo-container-registry=" + registryType);
    if (tl.getInput("namespace") != undefined) {
        commandToExecute.arg("--namespace=" + tl.getInput("namespace"));
    }
    var kubeConfigPath = downloadKubeconfigFileFromEndpoint();
    fs.chmodSync(kubeConfigPath, "777");
    commandToExecute.arg("--kube-config=" + kubeConfigPath);
}
function run() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const command = tl.getInput("command", true);
        var path;
        try {
            path = yield getWerfPath();
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, error.message);
            return;
        }
        var commandToExecute = tl.tool(path);
        commandToExecute.arg(command);
        if (command == "converge") {
            addConvergeCommandArgs(commandToExecute);
        }
        if (command == "dismiss") {
            addDismissCommandArgs(commandToExecute);
        }
        commandToExecute.line((_a = tl.getInput("arguments", false)) !== null && _a !== void 0 ? _a : "");
        try {
            yield commandToExecute.exec();
            tl.setResult(tl.TaskResult.Succeeded, "werf completed");
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, error.message);
        }
    });
}
function getWerfPath() {
    return __awaiter(this, void 0, void 0, function* () {
        var location = tl.getInput("versionOrLocation", true);
        if (location == 'location') {
            return tl.getPathInput("specifyLocation", true, true);
        }
        else if (location == 'version') {
            var version = tl.getInput("versionSpec");
            var channel = tl.getInput("versionChannel");
            let cachedToolpath = toolLib.findLocalTool("multiwerf", "1.0.0");
            if (!cachedToolpath) {
                var path = yield toolLib.downloadTool("https://raw.githubusercontent.com/werf/multiwerf/master/get.sh", "./get.sh");
                fs.chmodSync(path, "777");
                var res = tl.execSync(path, []).stderr;
                if (res) {
                    tl.warning(res);
                }
                //    fs.chmodSync("./multiwerf", "777"); 
                yield toolLib.cacheFile("./multiwerf", "multiwerf", "multiwerf", "1.0.0");
                cachedToolpath = toolLib.findLocalTool("multiwerf", "1.0.0");
            }
            yield tl.tool(cachedToolpath + "/multiwerf").arg("use").arg(version).arg(channel).arg("--as-file").exec();
            return "/usr/local/bin/werf";
        }
        else {
            let cachedToolpath = toolLib.findLocalTool("werf", "0.0.0");
            if (!cachedToolpath || !tl.getBoolInput("downloadOnce")) {
                var auth = [];
                if (tl.getInput("user")) {
                    auth = [new handlers.BasicCredentialHandler(tl.getInput("user"), tl.getInput("password"))];
                }
                var path = yield toolLib.downloadTool(tl.getInput("specifyUri", true), "./werf", auth);
                fs.chmodSync(path, "777");
                yield toolLib.cacheFile(path, "werf", "werf", "0.0.0");
                cachedToolpath = toolLib.findLocalTool("werf", "0.0.0");
            }
            return cachedToolpath + "/werf";
        }
    });
}
function getDockerToken() {
    var registryType = tl.getInput("containerRegistryType", true);
    var authenticationProvider;
    if (registryType == "Azure Container Registry") {
        authenticationProvider = new acrauthenticationtokenprovider.default(tl.getInput("azureSubscriptionEndpoint", true), tl.getInput("azureContainerRegistry", true));
    }
    else {
        authenticationProvider = new genericauthenticationtokenprovider.default(tl.getInput("dockerRegistryEndpoint", true));
    }
    return authenticationProvider.getAuthenticationToken();
}
function getDockerServerName() {
    return getDockerToken().getLoginServerUrl().replace("https://", "");
}
function downloadDockerConfigFromEndpoint() {
    var config = getDockerToken().getDockerConfig();
    var dockerconfigFile = path.join(userDir, "config.json");
    fs.writeFileSync(dockerconfigFile, config);
    return userDir;
}
function downloadKubeconfigFileFromEndpoint() {
    if (tl.getBoolInput("useConfigurationFile", true)) {
        return tl.getInput("configuration", true);
    }
    else {
        var kubernetesEndpoint = tl.getInput("kubernetesServiceEndpoint", true);
        var kubeconfigFile = path.join(userDir, "kubeconfig");
        var kubeconfig = tl.getEndpointAuthorizationParameter(kubernetesEndpoint, 'kubeconfig', false);
        fs.writeFileSync(kubeconfigFile, kubeconfig);
        return kubeconfigFile;
    }
}
function getTempDirectory() {
    return os.tmpdir();
}
function getCurrentTime() {
    return new Date().getTime();
}
function getNewUserDirPath() {
    var userDir = path.join(getTempDirectory(), "werfTask");
    ensureDirExists(userDir);
    userDir = path.join(userDir, getCurrentTime().toString());
    ensureDirExists(userDir);
    return userDir;
}
function ensureDirExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}
