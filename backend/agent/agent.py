from agent.tool_executor import ToolExecutor


class CyberDeskAgent:

    @staticmethod
    def run(
        ai_result,
        request,
        conversation,
        current_user,
        db
    ):

        return ToolExecutor.execute(
            tool_name=ai_result["intent"],
            request=request,
            conversation=conversation,
            current_user=current_user,
            db=db,
            ai_result=ai_result
        )