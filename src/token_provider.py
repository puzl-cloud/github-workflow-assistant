from datetime import datetime

from env import *
from src.utils.http import *
from src.models import Token


_TOKENS: Dict[int, Token] = {}

async def get_github_token(org_name: str = None) -> Token:
    if GITHUB_PERSONAL_ACCESS_TOKEN:
        return Token(value=GITHUB_PERSONAL_ACCESS_TOKEN, org=org_name)

    # ToDo [ASAP]: We have to get installation id by org here
    # FixMe: We must use user token here
    installation_id = 66728515
    
    if installation_id in _TOKENS and _TOKENS[installation_id].expires_at > datetime.now().timestamp():
        return _TOKENS[installation_id]
    
    oauth_response = await rest_api_request(
        HTTPMethod.GET, 
        f"{GITHUB_INSTALLATION_TOKEN_PROVIDER}/get-installation-token?"
        f"github_api_url={GITHUB_API_URL}&installation_id={installation_id}",
        {"Authorization": f"Bearer {GITHUB_INSTALLATION_TOKEN_PROVIDER_SECRET}"},
        "GitHub Installation JWT Provider")
    access_token = oauth_response["access_token"]
    _TOKENS[installation_id] = \
        Token(installation_id=installation_id, value=access_token, expires_at=int(datetime.now().timestamp()) + 3000)
    return _TOKENS[installation_id]
