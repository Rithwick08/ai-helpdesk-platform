import re
with open('/Users/rithwickreddy/ai-helpdesk-platform/backend/services/ai_service.py', 'r') as f:
    content = f.read()

if 'import logging' not in content:
    content = 'import logging\n' + content
    content = content.replace('import json', 'import json\nlogger = logging.getLogger(__name__)')

with open('/Users/rithwickreddy/ai-helpdesk-platform/backend/services/ai_service.py', 'w') as f:
    f.write(content)
