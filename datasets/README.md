# CICIDS2018 NetFlow Dataset Splits

Generated on: 2025-10-05 23:55:57
Random seed: 42

## Split Ratios
- **Development** (35%): 7,040,434 flows - Use for building tools and understanding patterns
- **Validation** (25%): 5,028,883 flows - Use for tuning thresholds and testing
- **Test** (40%): 8,046,212 flows - **NEVER use during development!** Final evaluation only

## Important Rules
1. ⚠️ **NEVER** let the LLM or tools see the test set during development
2. Build all detection rules using only the development set
3. Tune thresholds using the validation set
4. Evaluate final performance on the test set once at the end

## Attack Distribution
All three sets maintain the same proportions of each attack type (stratified split).

## Files
- `development.csv` - For tool development and pattern learning
- `validation.csv` - For threshold tuning and intermediate testing
- `test.csv` - For final evaluation (🔒 DO NOT TOUCH until ready!)
