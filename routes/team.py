# ==============================================================================
# AI INTELLIGENCE ZONE — Control Arena
# Team Web Routes — Session-based member portal pages
# ==============================================================================

from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user

from security import require_role


team_bp = Blueprint("team", __name__, url_prefix="/team")


@team_bp.route("/")
@login_required
@require_role("team_lead", "team_member", "super_admin", "admin", "moderator")
def index():
    """Team portal index (redirects to mission console)."""
    return redirect(url_for("team.mission_console"))


@team_bp.route("/mission-console")
@team_bp.route("/console")
@login_required
@require_role("team_lead", "team_member", "super_admin", "admin", "moderator")
def mission_console():
    """Team mission console UI."""
    return render_template("team/mission_console.html")
