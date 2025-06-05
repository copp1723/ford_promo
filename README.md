# PromoPilot AI 🚗

An intelligent automotive marketing automation agent built with the OpenAI Agents SDK. PromoPilot AI analyzes dealership inventory and OEM incentive data to provide strategic promotional recommendations that maximize sales velocity and profitability.

## Features

- **Intelligent Inventory Analysis**: Automatically analyzes vehicle aging, sales velocity, and market positioning
- **Incentive Optimization**: Evaluates OEM incentives to identify high-value promotional opportunities  
- **Strategic Recommendations**: Provides top 3 prioritized vehicle lines with clear business rationales
- **Automated Reporting**: Generates comprehensive reports in JSON, HTML, or Markdown formats
- **Real-time Insights**: On-demand analysis and custom queries via CLI interface
- **Error Handling**: Comprehensive error handling with user-friendly messages and categorization
- **Structured Logging**: Configurable logging with file output and log rotation
- **Performance Monitoring**: Built-in metrics collection with configurable thresholds
- **Access Control**: Role-based permissions system for multi-user environments
- **Schema Validation**: Strict input/output validation for all agent operations

## Quick Start

### Prerequisites

- Node.js 18+ 
- OpenAI API key

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

4. Run the agent:
   ```bash
   npm start
   ```

## Usage

### Basic Commands

```bash
# Run full promotional analysis
npm start

# Show inventory summary
node index.js inventory

# Show incentive summary  
node index.js incentives

# Check agent status
node index.js status

# Ask custom questions
node index.js "What vehicles should I promote this week?"
```

### Sample Data

The project includes sample data to get you started:

- **`data/sample-inventory.csv`**: Sample dealership inventory with 25 vehicles
- **`data/sample-incentives.json`**: Sample OEM incentive programs

### Custom Data

Replace the sample data with your actual dealership data:

1. **Inventory CSV Format**:
   ```csv
   VIN,Make,Model,Year,Trim,Color,MSRP,Invoice,StockNumber,DateReceived,Status,Location
   ```

2. **Incentives JSON Format**:
   ```json
   {
     "incentives": [
       {
         "make": "Honda",
         "model": "Civic", 
         "year": 2024,
         "type": "Customer Cash",
         "value": 1500,
         "start_date": "2024-11-01",
         "end_date": "2024-12-31"
       }
     ]
   }
   ```

## Architecture

### Core Components

- **`PromoPilotAgent`**: Main agent class that orchestrates analysis
- **`InventoryIngestor`**: Tool for parsing and analyzing CSV inventory data
- **`IncentiveFetcher`**: Tool for processing OEM incentive information
- **`ReportFormatter`**: Tool for generating structured promotional reports

### Business Logic

The agent considers multiple factors when making recommendations:

- **Aging Analysis**: Prioritizes vehicles with 45+ days on lot
- **Incentive Value**: Focuses on programs worth $1000+ 
- **Sales Velocity**: Identifies slow-moving inventory
- **Market Positioning**: Considers seasonal trends and demand

### Output

Reports include:
- Executive summary with key insights
- Top 3 ranked vehicle recommendations
- Detailed rationales for each recommendation
- Action items and next steps
- Supporting data and metrics

## Configuration

### Agent Settings

Edit `src/config/agent-config.js` to customize:

- OpenAI model and parameters
- Business rule thresholds
- System instructions
- Data source paths

### Environment Variables

Key environment variables in `.env`:

```bash
# Required
OPENAI_API_KEY=your_key_here

# Optional - API Configuration
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.3
OPENAI_MAX_TOKENS=2000

# Optional - Logging
LOG_LEVEL=2  # 0=ERROR, 1=WARN, 2=INFO, 3=DEBUG
LOG_TO_FILE=false

# Optional - Business Rules
AGING_THRESHOLD_DAYS=45
INCENTIVE_VALUE_THRESHOLD=1000
```

## Development

### Project Structure

```
ford_promo/
├── src/
│   ├── config/
│   │   └── agent-config.js     # Agent configuration
│   ├── tools/
│   │   ├── inventory-ingestor.js   # CSV inventory parser
│   │   ├── incentive-fetcher.js    # Incentive data processor  
│   │   └── report-formatter.js     # Report generator
│   ├── utils/
│   │   ├── access-control.js  # Role-based permissions
│   │   ├── error-handler.js   # Error handling utilities
│   │   ├── logger.js          # Structured logging
│   │   ├── metrics.js         # Performance metrics
│   │   └── schema-validator.js # Input/output validation
│   └── promopilot-agent.js     # Main agent class
├── data/
│   ├── sample-inventory.csv    # Sample inventory data
│   └── sample-incentives.json  # Sample incentive data
├── output/                     # Generated reports (auto-created)
├── logs/                       # Log files (when enabled)
├── .env.example                # Environment template
├── BUG_RESOLUTIONS.md          # Bug tracking document
├── test-scenarios.js           # Comprehensive test suite
├── index.js                    # CLI entry point
└── README.md
```

### Adding New Tools

1. Create tool file in `src/tools/`
2. Export tool definition and function
3. Register in `PromoPilotAgent.registerTools()`

### Extending Business Logic

Modify the agent's system instruction in `agent-config.js` to adjust:
- Recommendation criteria
- Analysis priorities  
- Output formatting
- Business rules

## Troubleshooting

### Common Issues

1. **Missing OpenAI API Key**
   ```
   Error: OPENAI_API_KEY environment variable is required
   ```
   Solution: Copy `.env.example` to `.env` and add your API key

2. **File Not Found Errors**
   ```
   Error: Inventory file not found: ./data/inventory.csv
   ```
   Solution: Ensure data files exist or update paths in config

3. **Tool Registration Errors**
   ```
   Error: Failed to initialize PromoPilot AI Agent
   ```
   Solution: Check the typo fix in `loadToolFunctions` (was `loadToolFuctions`)

4. **Performance Issues**
   - Monitor logs for threshold warnings
   - Check metrics summary for bottlenecks
   - Adjust thresholds in `src/utils/metrics.js`

For detailed bug history, see `BUG_RESOLUTIONS.md`

### Testing

Run the comprehensive test suite:
```bash
node test-scenarios.js
```

This runs:
- 6 happy path scenarios
- 3 destructive test scenarios
- Performance monitoring
- Error handling validation

### Debug Mode

Set environment variable for verbose logging:
```bash
LOG_LEVEL=3 npm start  # Enable DEBUG level logging
```

### Monitoring

The system collects metrics for:
- Operation latencies
- Error rates and categories
- Performance threshold breaches

Access metrics programmatically:
```javascript
import { getSummary } from './src/utils/metrics.js';
const metrics = getSummary();
```

## License

ISC License - see package.json for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review sample data formats
3. Verify environment configuration
4. Check OpenAI API key permissions
