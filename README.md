# K8s JMeter Load Testing Service

A comprehensive Kubernetes load testing dashboard that provides real-time monitoring, management, and analysis of JMeter load tests with integrated Kubernetes metrics.

![Dashboard Preview](https://images.pexels.com/photos/577585/pexels-photo-577585.jpeg?auto=compress&cs=tinysrgb&w=1200&h=400&fit=crop)

## 🚀 Features

- **Real-time Monitoring**: Live metrics for pods, CPU, memory, and network traffic
- **JMeter Integration**: Automated slave management and test execution
- **HPA Management**: Dynamic horizontal pod autoscaler configuration
- **Interactive Dashboard**: Modern, responsive web interface with real-time charts
- **Resource Tracking**: Detailed pod and node resource utilization
- **Test Configuration**: Built-in JMX file editor for test plan customization
- **Report Generation**: Automatic HTML report generation with downloadable results

## 📋 Prerequisites

Before setting up the K8s JMeter Load Testing Service, ensure you have:

### System Requirements
- **Kubernetes Cluster**: Running cluster with kubectl access
- **Node.js**: Version 16 or higher
- **JMeter**: Installed on master and slave nodes
- **SSH Access**: Passwordless SSH to all JMeter nodes

### Required Tools
```bash
# Kubernetes CLI
kubectl version --client

# Node.js and npm
node --version
npm --version

# JMeter (on test nodes)
jmeter --version
```

### Network Configuration
- Master node accessible from dashboard server
- Slave nodes accessible from master node
- Kubernetes API server accessible from dashboard server

## 🛠️ Installation & Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd k8s-jmeter-load-testing-service

# Install dependencies
npm install
```

### 2. Configure Environment

Edit the configuration in `server.js`:

```javascript
// Update these values according to your setup
const MASTER_IP = "164.52.211.192";           // JMeter master node IP
const JMETER_PATH = "/root/jmeter";            // JMeter installation path
const JMETER_TEST = "gabiru.jmx";              // Default test file name
const JMETER_SLAVES = [                        // Slave node IPs
  "164.52.212.41", 
  "164.52.212.42"
];
const NAMESPACE = "prod";                      // Kubernetes namespace
const LABEL_SELECTOR = "app=imgproxy-imgproxy"; // Pod selector
```

### 3. Setup JMeter Nodes

#### Master Node Setup
```bash
# Install JMeter
wget https://downloads.apache.org/jmeter/binaries/apache-jmeter-5.6.2.tgz
tar -xzf apache-jmeter-5.6.2.tgz
mv apache-jmeter-5.6.2 /root/jmeter

# Create directories
mkdir -p /root/jmeter/results
mkdir -p /root/jmeter/reports

# Upload your JMX test file
scp your-test.jmx root@MASTER_IP:/root/jmeter/gabiru.jmx
```

#### Slave Nodes Setup
```bash
# On each slave node
wget https://downloads.apache.org/jmeter/binaries/apache-jmeter-5.6.2.tgz
tar -xzf apache-jmeter-5.6.2.tgz
mv apache-jmeter-5.6.2 /root/jmeter

# Configure JMeter properties (if needed)
echo "server.rmi.ssl.disable=true" >> /root/jmeter/bin/jmeter.properties
```

### 4. Configure SSH Access

Setup passwordless SSH from dashboard server to all JMeter nodes:

```bash
# Generate SSH key (if not exists)
ssh-keygen -t rsa -b 4096

# Copy public key to all nodes
ssh-copy-id root@MASTER_IP
ssh-copy-id root@SLAVE_IP_1
ssh-copy-id root@SLAVE_IP_2

# Test connectivity
ssh root@MASTER_IP "echo 'Master connection OK'"
ssh root@SLAVE_IP_1 "echo 'Slave 1 connection OK'"
ssh root@SLAVE_IP_2 "echo 'Slave 2 connection OK'"
```

### 5. Configure Kubernetes Access

Ensure kubectl is configured and can access your cluster:

```bash
# Test cluster access
kubectl cluster-info
kubectl get nodes
kubectl get pods -n prod

# Verify metrics server is running
kubectl top nodes
kubectl top pods -n prod
```

## 🚀 Running the Dashboard

### Development Mode
```bash
npm start
```

### Production Mode
```bash
# Using PM2 (recommended)
npm install -g pm2
pm2 start server.js --name "k8s-load-dashboard"
pm2 save
pm2 startup

# Or using nohup
nohup node server.js > dashboard.log 2>&1 &
```

The dashboard will be available at `http://localhost:4000`

## 📊 How to Use

### 1. Starting a Load Test

1. **Access Dashboard**: Open `http://localhost:4000` in your browser
2. **Check Slave Status**: Verify all slave servers are running
3. **Start Slaves** (if needed): Click "Start Slave Servers" button
4. **Configure Test**: Edit JMX file using the built-in editor
5. **Run Test**: Click "Start JMeter Test" button
6. **Monitor Progress**: Watch real-time logs and metrics
7. **View Results**: Access generated reports when test completes

### 2. Managing Resources

#### HPA Configuration
1. Navigate to the "Management" section
2. Click "Load HPA List" to see available HPAs
3. Select an HPA from the dropdown
4. Adjust min/max replica values
5. Click "Save HPA Configuration"

#### JMX File Editing
1. Click "Edit JMX File" in the Management section
2. Modify test parameters in the editor
3. Save changes to update the test configuration

### 3. Monitoring Metrics

The dashboard provides several monitoring views:

- **Pod Metrics**: Real-time pod count, CPU, and memory usage
- **Node Metrics**: Node-level resource utilization
- **Per-Pod Analysis**: Individual pod performance tracking
- **Timeline Events**: Scaling events and system changes
- **Resource Tables**: Detailed resource allocation data

## 🔧 Configuration Options

### Server Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `PORT` | Dashboard server port | `4000` |
| `MASTER_IP` | JMeter master node IP | `164.52.211.192` |
| `JMETER_PATH` | JMeter installation path | `/root/jmeter` |
| `JMETER_TEST` | Default JMX test file | `gabiru.jmx` |
| `JMETER_SLAVES` | Array of slave node IPs | `["164.52.212.41", "164.52.212.42"]` |
| `NAMESPACE` | Kubernetes namespace | `prod` |
| `LABEL_SELECTOR` | Pod label selector | `app=imgproxy-imgproxy` |

### JMeter Configuration

Customize JMeter behavior by editing properties files:

```bash
# On master node
vi /root/jmeter/bin/jmeter.properties

# Common settings
server.rmi.ssl.disable=true
jmeter.save.saveservice.output_format=xml
jmeter.save.saveservice.response_data=false
```

## 📈 API Endpoints

The dashboard exposes several REST API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/start-slaves` | GET | Start JMeter slave servers |
| `/api/stop-slaves` | GET | Stop JMeter slave servers |
| `/api/start-test` | GET | Execute JMeter load test |
| `/api/slave-status` | GET | Get slave server status |
| `/api/metrics` | GET | Get pod metrics |
| `/api/nodes` | GET | Get node metrics |
| `/api/hpa` | GET/POST | Manage HPA configurations |
| `/api/jmx` | GET/POST | Manage JMX test files |
| `/api/logs` | GET | Stream live logs (SSE) |

## 🐛 Troubleshooting

### Common Issues

#### 1. SSH Connection Failed
```bash
# Check SSH connectivity
ssh -v root@MASTER_IP

# Verify SSH key authentication
ssh-add -l
```

#### 2. Kubectl Access Denied
```bash
# Check cluster configuration
kubectl config current-context
kubectl auth can-i get pods --namespace=prod
```

#### 3. JMeter Slaves Not Starting
```bash
# Check JMeter installation
ssh root@SLAVE_IP "ls -la /root/jmeter/bin/"

# Check firewall settings
ssh root@SLAVE_IP "netstat -tlnp | grep 1099"
```

#### 4. Metrics Not Loading
```bash
# Verify metrics server
kubectl get pods -n kube-system | grep metrics-server

# Check pod labels
kubectl get pods -n prod --show-labels
```

### Log Files

Monitor these log files for debugging:

- Dashboard logs: `dashboard.log` (if using nohup)
- JMeter master logs: `/root/jmeter/jmeter.log`
- JMeter slave logs: `/root/jmeter/jmeter-server-*.log`
- Kubernetes logs: `kubectl logs -n kube-system deployment/metrics-server`

## 🔒 Security Considerations

- **SSH Keys**: Use dedicated SSH keys with limited permissions
- **Network Access**: Restrict dashboard access using firewall rules
- **Kubernetes RBAC**: Configure appropriate service account permissions
- **SSL/TLS**: Consider using HTTPS in production environments

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

1. Check the troubleshooting section above
2. Review the API documentation
3. Create an issue in the repository
4. Contact the development team

---

**Built with ❤️ for Kubernetes load testing**