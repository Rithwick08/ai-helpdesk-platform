from tools.password_reset_tool import PasswordResetTool
from tools.it_support_tool import ITSupportTool
from tools.incident_tool import IncidentTool
from tools.security_training_tool import SecurityTrainingTool
from tools.general_chat_tool import GeneralChatTool

TOOLS = {

    "password_reset": PasswordResetTool(),

    "it_support": ITSupportTool(),

    "security_incident": IncidentTool(),

    "security_awareness": SecurityTrainingTool(),

    "general_question": GeneralChatTool()

}