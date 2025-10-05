# Datasets Directory

This directory contains the split CICIDS2018 NetFlow datasets.

## ⚠️ Important: Dataset Files Not in Git

The CSV files are **too large** for GitHub (>100MB each) and are **not tracked** in this repository.

### Dataset Files (Local Only)
- `development.csv` - 7M flows, 1.4 GB (35% of data)
- `validation.csv` - 5M flows, 1.0 GB (25% of data)
- `test.csv` - 8M flows, 1.6 GB (40% of data)

## 📥 How to Obtain the Datasets

### Option 1: Generate from Source Data

1. Download the original CICIDS2018 dataset from:
   - https://www.unb.ca/cic/datasets/ids-2018.html
   - OR https://espace.library.uq.edu.au/view/UQ:ece9b83

2. Run the splitting script:
   ```bash
   cd ..
   python split_dataset.py
   ```

### Option 2: Use Your Own Data

The MCP server can work with any NetFlow CSV that has these columns:
- `IPV4_SRC_ADDR`, `IPV4_DST_ADDR`
- `L4_SRC_PORT`, `L4_DST_PORT`
- `PROTOCOL`, `IN_PKTS`, `OUT_PKTS`
- Additional NetFlow v3 features (see `NetFlow_v3_Features.csv`)

## 📊 Dataset Statistics

**Total**: 20,115,529 flows from CICIDS2018 NetFlow v3

**Attack Distribution**:
- Benign: 87.07% (17.5M flows)
- DDoS-HOIC: 5.13% (1.0M flows)
- FTP-BruteForce: 1.92% (387K flows)
- DDoS-LOIC-HTTP: 1.43% (289K flows)
- Bot: 1.03% (208K flows)
- SSH-Bruteforce: 0.94% (188K flows)
- Others: <1% each

**Stratified Split**: All sets maintain proportional representation of each attack type.

## 🔒 Usage Guidelines

- **Development Set**: Use freely for building and testing tools
- **Validation Set**: Use for tuning thresholds and intermediate testing
- **Test Set**: ⚠️ **DO NOT USE** until final evaluation! Reserve for unbiased performance measurement

## 📝 Notes

- Files are in `.gitignore` to prevent accidental commits
- Keep datasets synchronized across your local development environment
- Consider using external storage (Google Drive, AWS S3) for backups
