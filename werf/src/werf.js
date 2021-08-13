"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib");
const path = require("path");
const fs = require("fs");
const acrauthenticationtokenprovider = require("docker-common/registryauthenticationprovider/acrauthenticationtokenprovider");
const genericauthenticationtokenprovider = require("docker-common/registryauthenticationprovider/genericauthenticationtokenprovider");
const os = require("os");
var userDir = getNewUserDirPath();
run();
function addConvergeCommandArgs(commandToExecute) {
    var _a, _b;
    if ((_a = tl.getInput("sendDockerConfigToChart")) !== null && _a !== void 0 ? _a : false) {
        commandToExecute.arg("--set-docker-config-json-value=true");
    }
    var dockerPath = downloadDockerConfigFromEndpoint();
    fs.chmodSync(dockerPath + "/config.json", "777");
    commandToExecute.arg("--docker-config=" + dockerPath);
    var dockerServer = getDockerServerName();
    commandToExecute.arg("--repo=" + dockerServer + ((_b = tl.getInput("layerRepo")) !== null && _b !== void 0 ? _b : "/portal-drms"));
    var registryType;
    if (tl.getInput("containerRegistryType", true) == 'Azure Container Registry') {
        registryType = "acr";
    }
    else {
        registryType = "default";
    }
    commandToExecute.arg("--repo-container-registry=" + registryType);
    commandToExecute.arg("--namespace=" + tl.getInput("namespace"));
    var kubeConfigPath = downloadKubeconfigFileFromEndpoint();
    fs.chmodSync(kubeConfigPath, "777");
    commandToExecute.arg("--kube-config=" + kubeConfigPath + "");
}
function addDismissCommandArgs(commandToExecute) {
    var _a;
    var dockerPath = downloadDockerConfigFromEndpoint();
    fs.chmodSync(dockerPath + "/config.json", "777");
    commandToExecute.arg("--docker-config=" + dockerPath);
    var dockerServer = getDockerServerName();
    commandToExecute.arg("--repo=" + dockerServer + ((_a = tl.getInput("layerRepo")) !== null && _a !== void 0 ? _a : "/portal-drms"));
    var registryType;
    if (tl.getInput("containerRegistryType", true) == 'Azure Container Registry') {
        registryType = "acr";
    }
    else {
        registryType = "default";
    }
    commandToExecute.arg("--repo-container-registry=" + registryType);
    commandToExecute.arg("--namespace=" + tl.getInput("namespace"));
    var kubeConfigPath = downloadKubeconfigFileFromEndpoint();
    fs.chmodSync(kubeConfigPath, "777");
    commandToExecute.arg("--kube-config=" + kubeConfigPath);
}
function run() {
    var _a;
    const command = tl.getInput("command", true);
    var commandToExecute = tl.tool(getWerfPath());
    commandToExecute.arg(command);
    commandToExecute.arg("--home-dir=" + userDir);
    if (command == "converge") {
        addConvergeCommandArgs(commandToExecute);
    }
    if (command == "dismiss") {
        addDismissCommandArgs(commandToExecute);
    }
    commandToExecute.line((_a = tl.getInput("arguments", false)) !== null && _a !== void 0 ? _a : "");
    commandToExecute.exec().then(() => tl.setResult(tl.TaskResult.Succeeded, "werf completed"), (error) => tl.setResult(tl.TaskResult.Failed, error.message))
        .catch((error) => tl.setResult(tl.TaskResult.Failed, error.message)).done();
}
function getWerfPath() {
    if (tl.getInput("versionOrLocation") == 'location') {
        return tl.getPathInput("specifyLocation", true, true);
    }
    else {
        return "/usr/local/bin/werf";
    }
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
