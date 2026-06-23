from models.password_reset import PasswordReset
from agent.assistant_ai import classify_confirmation

class PasswordResetTool:

    def execute(
        self,
        request,
        conversation,
        current_user,
        db,
        ai_result
    ):

        # First time entering the tool
        if conversation.pending_action is None:

            account_type = ai_result["entities"].get("account_type")

            if account_type:

                conversation.summary = account_type
                conversation.pending_action = "password_reset_confirmation"

                db.commit()

                return {
                    "status": "waiting",
                    "response": f"You want to reset your {account_type} password.\n\nShould I create the password reset request? (Yes/No)"
                }

            conversation.pending_action = "password_reset_account"

            db.commit()

            return {
                "status": "waiting",
                "response": "Which account would you like to reset?\n\n1. Windows Login\n2. VPN\n3. Microsoft 365\n4. Email\n5. Other"
            }
        # Waiting for account type
        if conversation.pending_action == "password_reset_account":

            conversation.summary = request.message
            conversation.pending_action = "password_reset_confirmation"

            db.commit()

            return {
                "status": "waiting",
                "response": f"You want to reset your **{request.message}** password.\n\nShould I create the password reset request? (Yes/No)"
            }

        # Waiting for confirmation
        if conversation.pending_action == "password_reset_confirmation":

            confirmed = classify_confirmation(
                request.message
            )

            if not confirmed:

                conversation.pending_action = None
                conversation.summary = None

                db.commit()

                return {
                    "status": "cancelled",
                    "response": "Password reset cancelled."
                }

            reset = PasswordReset(

                employee_id=current_user.employee_id,

                account_type=conversation.summary,

                reason="Requested through AI Assistant",

                priority="Medium",

                action_taken="Pending",

                status="Pending"

            )

            db.add(reset)
            db.commit()
            db.refresh(reset)

            conversation.pending_action = None
            conversation.summary = None

            db.commit()

            return {
                "status": "completed",
                "response": f"✅ Password Reset Request #{reset.id} has been created successfully."
            }