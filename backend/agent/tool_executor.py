from agent.tool_registry import TOOLS


class ToolExecutor:

    @staticmethod
    def execute(
        tool_name,
        request,
        conversation,
        current_user,
        db,
        ai_result
    ):

        tool = TOOLS.get(tool_name)

        if tool is None:

            return {

                "response": "I don't know how to handle that request.",

                "status": "error"

            }

        return tool.execute(
            request,
            conversation,
            current_user,
            db,
            ai_result
        )