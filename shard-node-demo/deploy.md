# adveunture-layer-shard-scripts
## Deployment
### Prerequisites

#### 1. Docker
```shell
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do 
  sudo apt-get remove $pkg
done

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx

sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
# check
docker version
```
#### 2. docker-compose
```shell
sudo mkdir -p /usr/libexec/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/download/v2.26.1/docker-compose-linux-x86_64 -o /usr/libexec/docker/cli-plugins/docker-compose
sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose
sudo ln -s /usr/libexec/docker/cli-plugins/docker-compose /usr/bin/docker-compose

# check
docker compose version
```
#### 3. direnv
```shell
sudo apt-get install -y direnv
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
source ~/.bashrc
# check
direnv version
```

### Clone the repository.

> Notice: release branch may be force-pushed at any time.

```bash
git clone https://github.com/AdventureGoldDao/adventure-layer-shard-scripts.git
cd shard-node-demo
```

Initialize the node

### up env
```shell
cp .envrc.example .envrc

direnv allow
```

```shell
./tol2.bash script send-l1 --ethamount 3 --to funnel --wait
```

### look address
```shell
./tol2.bash script print-address --account funnel
```

### look address private-key
```shell
./tol2.bash script print-private-key --account sequencer
```

Initialize the node
```bash
./tol2.bash --init
```

```bash
./tol2.bash script send-l2 --ethamount 1 --to address_0x1111222233334444555566667777888899990000
```

For help and further scripts, see:

```bash
./tol2.bash script --help
```

### cat config
```shell
docker compose run --entrypoint sh sequencer -c "ls /config"
```

### gas token erc20
### 
```shell
# cat tokenAddress is native-token in: docker compose run --entrypoint sh scripts -c "cat /config/l3deployment.json"  
 ./tol2.bash script transfer-erc20 -l1 --token 0x***********Cf13dd6706 --amount 1000 --from user_fee_token_deployer --to l2owner

 ./tol2.bash script bridge-native-token-to-l2 --amount 10 --from l2owner --wait
```

