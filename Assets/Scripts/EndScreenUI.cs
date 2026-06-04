using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

// Écran de fin plein écran, affiché quand le joueur sort de la zone par la porte ouverte.
// Même pattern que DialogueBox / DeckUI : singleton auto-spawn, UI construite en code,
// persistant entre les scènes (DontDestroyOnLoad). On appelle EndScreenUI.Instance.Show(message).
public class EndScreenUI : MonoBehaviour
{
    public static EndScreenUI Instance { get; private set; }

    public bool IsOpen => panel != null && panel.activeSelf;

    // Doit correspondre au nom EXACT de la scène de menu (et être présente dans les Build Settings).
    private const string MainMenuScene = "MainMenu";

    private GameObject panel;
    private Text messageText;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    private static void AutoSpawn()
    {
        if (Instance != null) return;
        GameObject go = new GameObject("[EndScreenUI]");
        DontDestroyOnLoad(go);
        go.AddComponent<EndScreenUI>();
    }

    private void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
        EnsureEventSystem();
        BuildUI();
        panel.SetActive(false);
    }

    private void EnsureEventSystem()
    {
        if (EventSystem.current != null) return;
        GameObject es = new GameObject("[EventSystem]");
        es.AddComponent<EventSystem>();
        es.AddComponent<InputSystemUIInputModule>();
        DontDestroyOnLoad(es);
    }

    private void BuildUI()
    {
        Canvas canvas = gameObject.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 200; // au-dessus de DialogueBox (100) et DeckUI (150)

        CanvasScaler scaler = gameObject.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);

        gameObject.AddComponent<GraphicRaycaster>();

        panel = new GameObject("Panel");
        panel.transform.SetParent(transform, false);
        Image bg = panel.AddComponent<Image>();
        bg.color = new Color(0.07f, 0.07f, 0.12f, 0.97f);
        RectTransform panelRect = bg.rectTransform;
        panelRect.anchorMin = Vector2.zero;
        panelRect.anchorMax = Vector2.one;
        panelRect.offsetMin = Vector2.zero;
        panelRect.offsetMax = Vector2.zero;

        Font font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

        GameObject msgGO = new GameObject("Message");
        msgGO.transform.SetParent(panel.transform, false);
        messageText = msgGO.AddComponent<Text>();
        messageText.text = "Merci d'avoir joué !";
        messageText.font = font;
        messageText.fontSize = 56;
        messageText.fontStyle = FontStyle.Bold;
        messageText.color = Color.white;
        messageText.alignment = TextAnchor.MiddleCenter;
        messageText.horizontalOverflow = HorizontalWrapMode.Wrap;
        messageText.verticalOverflow = VerticalWrapMode.Truncate;
        RectTransform msgRect = messageText.rectTransform;
        msgRect.anchorMin = new Vector2(0.1f, 0.55f);
        msgRect.anchorMax = new Vector2(0.9f, 0.9f);
        msgRect.offsetMin = Vector2.zero;
        msgRect.offsetMax = Vector2.zero;

        CreateButton("Rejouer", 0.42f, font, Replay);
        CreateButton("Menu principal", 0.30f, font, GoToMenu);
        CreateButton("Quitter", 0.18f, font, QuitGame);
    }

    private void CreateButton(string label, float yMin, Font font, UnityEngine.Events.UnityAction onClick)
    {
        GameObject btnGO = new GameObject($"Btn_{label}");
        btnGO.transform.SetParent(panel.transform, false);
        Image btnBg = btnGO.AddComponent<Image>();
        btnBg.color = new Color(0.9f, 0.9f, 0.95f);
        Button btn = btnGO.AddComponent<Button>();
        btn.onClick.AddListener(onClick);

        RectTransform rect = btn.GetComponent<RectTransform>();
        rect.anchorMin = new Vector2(0.35f, yMin);
        rect.anchorMax = new Vector2(0.65f, yMin + 0.09f);
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;

        GameObject txtGO = new GameObject("Text");
        txtGO.transform.SetParent(btnGO.transform, false);
        Text txt = txtGO.AddComponent<Text>();
        txt.text = label;
        txt.font = font;
        txt.fontSize = 28;
        txt.color = Color.black;
        txt.alignment = TextAnchor.MiddleCenter;
        RectTransform txtRect = txt.rectTransform;
        txtRect.anchorMin = Vector2.zero;
        txtRect.anchorMax = Vector2.one;
        txtRect.offsetMin = Vector2.zero;
        txtRect.offsetMax = Vector2.zero;
    }

    public void Show(string message)
    {
        if (!string.IsNullOrEmpty(message)) messageText.text = message;
        panel.SetActive(true);
    }

    public void Hide() => panel.SetActive(false);

    // Recharge la scène courante (rejouer la zone à zéro).
    private void Replay()
    {
        Hide();
        SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
    }

    private void GoToMenu()
    {
        Hide();
        SceneManager.LoadScene(MainMenuScene);
    }

    private void QuitGame()
    {
#if UNITY_EDITOR
        UnityEditor.EditorApplication.isPlaying = false;
#else
        Application.Quit();
#endif
    }
}
