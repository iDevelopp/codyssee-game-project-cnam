using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

// Contrôleur du menu principal. À poser sur un GameObject vide dans la scène "MainMenu".
// Construit l'UI en code (même style que les autres UI du projet) : aucun Canvas à monter à la main.
// Le bouton "Jouer" charge la scène de jeu (gameplaySceneName), qui doit être dans les Build Settings.
public class MainMenuController : MonoBehaviour
{
    [SerializeField] private string gameplaySceneName = "Zone_1";
    [SerializeField] private string gameTitle = "Codyssey";
    [SerializeField, TextArea(1, 3)] private string tagline = "Un voyage à travers l'histoire des langages de programmation";

    private void Awake()
    {
        EnsureEventSystem();
        BuildUI();
    }

    private void EnsureEventSystem()
    {
        if (EventSystem.current != null) return;
        GameObject es = new GameObject("[EventSystem]");
        es.AddComponent<EventSystem>();
        es.AddComponent<InputSystemUIInputModule>();
    }

    private void BuildUI()
    {
        Canvas canvas = gameObject.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 0;

        CanvasScaler scaler = gameObject.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);

        gameObject.AddComponent<GraphicRaycaster>();

        GameObject bgGO = new GameObject("Background");
        bgGO.transform.SetParent(transform, false);
        Image bg = bgGO.AddComponent<Image>();
        bg.color = new Color(0.07f, 0.07f, 0.12f, 1f);
        RectTransform bgRect = bg.rectTransform;
        bgRect.anchorMin = Vector2.zero;
        bgRect.anchorMax = Vector2.one;
        bgRect.offsetMin = Vector2.zero;
        bgRect.offsetMax = Vector2.zero;

        Font font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

        GameObject titleGO = new GameObject("Title");
        titleGO.transform.SetParent(transform, false);
        Text title = titleGO.AddComponent<Text>();
        title.text = gameTitle;
        title.font = font;
        title.fontSize = 90;
        title.fontStyle = FontStyle.Bold;
        title.color = Color.white;
        title.alignment = TextAnchor.MiddleCenter;
        RectTransform titleRect = title.rectTransform;
        titleRect.anchorMin = new Vector2(0.1f, 0.68f);
        titleRect.anchorMax = new Vector2(0.9f, 0.9f);
        titleRect.offsetMin = Vector2.zero;
        titleRect.offsetMax = Vector2.zero;

        GameObject taglineGO = new GameObject("Tagline");
        taglineGO.transform.SetParent(transform, false);
        Text tag = taglineGO.AddComponent<Text>();
        tag.text = tagline;
        tag.font = font;
        tag.fontSize = 28;
        tag.fontStyle = FontStyle.Italic;
        tag.color = new Color(0.8f, 0.8f, 0.9f);
        tag.alignment = TextAnchor.MiddleCenter;
        tag.horizontalOverflow = HorizontalWrapMode.Wrap;
        RectTransform tagRect = tag.rectTransform;
        tagRect.anchorMin = new Vector2(0.15f, 0.58f);
        tagRect.anchorMax = new Vector2(0.85f, 0.67f);
        tagRect.offsetMin = Vector2.zero;
        tagRect.offsetMax = Vector2.zero;

        CreateButton("Jouer", 0.38f, font, Play);
        CreateButton("Quitter", 0.24f, font, QuitGame);
    }

    private void CreateButton(string label, float yMin, Font font, UnityEngine.Events.UnityAction onClick)
    {
        GameObject btnGO = new GameObject($"Btn_{label}");
        btnGO.transform.SetParent(transform, false);
        Image btnBg = btnGO.AddComponent<Image>();
        btnBg.color = new Color(0.9f, 0.9f, 0.95f);
        Button btn = btnGO.AddComponent<Button>();
        btn.onClick.AddListener(onClick);

        RectTransform rect = btn.GetComponent<RectTransform>();
        rect.anchorMin = new Vector2(0.38f, yMin);
        rect.anchorMax = new Vector2(0.62f, yMin + 0.1f);
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;

        GameObject txtGO = new GameObject("Text");
        txtGO.transform.SetParent(btnGO.transform, false);
        Text txt = txtGO.AddComponent<Text>();
        txt.text = label;
        txt.font = font;
        txt.fontSize = 32;
        txt.color = Color.black;
        txt.alignment = TextAnchor.MiddleCenter;
        RectTransform txtRect = txt.rectTransform;
        txtRect.anchorMin = Vector2.zero;
        txtRect.anchorMax = Vector2.one;
        txtRect.offsetMin = Vector2.zero;
        txtRect.offsetMax = Vector2.zero;
    }

    private void Play()
    {
        if (string.IsNullOrEmpty(gameplaySceneName))
        {
            Debug.LogError("[MainMenu] gameplaySceneName est vide — impossible de lancer le jeu.");
            return;
        }
        SceneManager.LoadScene(gameplaySceneName);
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
