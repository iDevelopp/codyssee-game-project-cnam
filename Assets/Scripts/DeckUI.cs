using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class DeckUI : MonoBehaviour
{
    public static DeckUI Instance { get; private set; }

    public bool IsOpen => panel != null && panel.activeSelf;

    private GameObject panel;
    private GameObject dimOverlay;
    private Transform cardsContainer;
    private Text titleText;
    private Action<CardData> onCardPicked;
    private readonly List<GameObject> cardButtons = new List<GameObject>();

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    private static void AutoSpawn()
    {
        if (Instance != null) return;
        GameObject go = new GameObject("[DeckUI]");
        DontDestroyOnLoad(go);
        go.AddComponent<DeckUI>();
    }

    private void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
        BuildUI();
        dimOverlay.SetActive(false);
        panel.SetActive(false);
    }

    private void BuildUI()
    {
        Canvas canvas = gameObject.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 150;

        CanvasScaler scaler = gameObject.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);

        gameObject.AddComponent<GraphicRaycaster>();

        dimOverlay = new GameObject("Dim");
        GameObject dim = dimOverlay;
        dim.transform.SetParent(transform, false);
        Image dimImg = dim.AddComponent<Image>();
        dimImg.color = new Color(0f, 0f, 0f, 0.55f);
        RectTransform dimRect = dimImg.rectTransform;
        dimRect.anchorMin = Vector2.zero;
        dimRect.anchorMax = Vector2.one;
        dimRect.offsetMin = Vector2.zero;
        dimRect.offsetMax = Vector2.zero;

        panel = new GameObject("Panel");
        panel.transform.SetParent(transform, false);
        Image bg = panel.AddComponent<Image>();
        bg.color = Color.white;
        RectTransform panelRect = bg.rectTransform;
        panelRect.anchorMin = new Vector2(0.1f, 0.20f);
        panelRect.anchorMax = new Vector2(0.9f, 0.80f);
        panelRect.offsetMin = Vector2.zero;
        panelRect.offsetMax = Vector2.zero;

        Font font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

        GameObject titleGO = new GameObject("Title");
        titleGO.transform.SetParent(panel.transform, false);
        titleText = titleGO.AddComponent<Text>();
        titleText.text = "Choisis ta réponse";
        titleText.font = font;
        titleText.fontSize = 40;
        titleText.fontStyle = FontStyle.Bold;
        titleText.color = Color.black;
        titleText.alignment = TextAnchor.MiddleCenter;
        RectTransform titleRect = titleText.rectTransform;
        titleRect.anchorMin = new Vector2(0f, 0.85f);
        titleRect.anchorMax = new Vector2(1f, 1f);
        titleRect.offsetMin = Vector2.zero;
        titleRect.offsetMax = Vector2.zero;

        GameObject containerGO = new GameObject("Cards");
        containerGO.transform.SetParent(panel.transform, false);
        RectTransform containerRect = containerGO.AddComponent<RectTransform>();
        containerRect.anchorMin = new Vector2(0.02f, 0.05f);
        containerRect.anchorMax = new Vector2(0.98f, 0.83f);
        containerRect.offsetMin = Vector2.zero;
        containerRect.offsetMax = Vector2.zero;
        cardsContainer = containerGO.transform;
    }

    public void Open(IReadOnlyList<CardData> cards, Action<CardData> onPicked, string title = null)
    {
        if (cards == null || cards.Count == 0)
        {
            Debug.LogWarning("[DeckUI] Open called with empty card list");
            return;
        }

        if (!string.IsNullOrEmpty(title)) titleText.text = title;
        onCardPicked = onPicked;
        BuildCardButtons(cards);
        dimOverlay.SetActive(true);
        panel.SetActive(true);
    }

    public void Open(Deck deck, Action<CardData> onPicked, string title = null)
    {
        Open(deck?.Cards, onPicked, title);
    }

    public void Close()
    {
        onCardPicked = null;
        panel.SetActive(false);
        dimOverlay.SetActive(false);
        UnityEngine.EventSystems.EventSystem.current?.SetSelectedGameObject(null);
    }

    private void BuildCardButtons(IReadOnlyList<CardData> cards)
    {
        foreach (GameObject b in cardButtons) Destroy(b);
        cardButtons.Clear();

        int n = cards.Count;
        float gap = 0.02f;
        float cardWidth = (1f - gap * (n + 1)) / n;

        Font font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

        for (int i = 0; i < n; i++)
        {
            CardData card = cards[i];

            GameObject btnGO = new GameObject($"Card_{card.DisplayName}");
            btnGO.transform.SetParent(cardsContainer, false);
            Image btnBg = btnGO.AddComponent<Image>();
            btnBg.color = new Color(0.96f, 0.93f, 0.82f);
            Button btn = btnGO.AddComponent<Button>();
            CardData captured = card;
            btn.onClick.AddListener(() => OnCardClicked(captured));

            RectTransform rect = btn.GetComponent<RectTransform>();
            float xMin = gap + i * (cardWidth + gap);
            rect.anchorMin = new Vector2(xMin, 0.05f);
            rect.anchorMax = new Vector2(xMin + cardWidth, 0.95f);
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;

            GameObject nameGO = new GameObject("Name");
            nameGO.transform.SetParent(btnGO.transform, false);
            Text nameText = nameGO.AddComponent<Text>();
            nameText.text = card.DisplayName;
            nameText.font = font;
            nameText.fontSize = 36;
            nameText.fontStyle = FontStyle.Bold;
            nameText.color = Color.black;
            nameText.alignment = TextAnchor.MiddleCenter;
            RectTransform nameRect = nameText.rectTransform;
            nameRect.anchorMin = new Vector2(0.05f, 0.70f);
            nameRect.anchorMax = new Vector2(0.95f, 0.95f);
            nameRect.offsetMin = Vector2.zero;
            nameRect.offsetMax = Vector2.zero;

            GameObject descGO = new GameObject("Description");
            descGO.transform.SetParent(btnGO.transform, false);
            Text descText = descGO.AddComponent<Text>();
            descText.text = card.Description;
            descText.font = font;
            descText.fontSize = 18;
            descText.color = Color.black;
            descText.alignment = TextAnchor.UpperCenter;
            descText.horizontalOverflow = HorizontalWrapMode.Wrap;
            descText.verticalOverflow = VerticalWrapMode.Truncate;
            RectTransform descRect = descText.rectTransform;
            descRect.anchorMin = new Vector2(0.05f, 0.30f);
            descRect.anchorMax = new Vector2(0.95f, 0.70f);
            descRect.offsetMin = Vector2.zero;
            descRect.offsetMax = Vector2.zero;

            GameObject usageGO = new GameObject("Usage");
            usageGO.transform.SetParent(btnGO.transform, false);
            Text usageText = usageGO.AddComponent<Text>();
            usageText.text = card.Usage;
            usageText.font = font;
            usageText.fontSize = 16;
            usageText.fontStyle = FontStyle.Italic;
            usageText.color = new Color(0.3f, 0.3f, 0.3f);
            usageText.alignment = TextAnchor.LowerCenter;
            usageText.horizontalOverflow = HorizontalWrapMode.Wrap;
            RectTransform usageRect = usageText.rectTransform;
            usageRect.anchorMin = new Vector2(0.05f, 0.05f);
            usageRect.anchorMax = new Vector2(0.95f, 0.28f);
            usageRect.offsetMin = Vector2.zero;
            usageRect.offsetMax = Vector2.zero;

            cardButtons.Add(btnGO);
        }
    }

    private void OnCardClicked(CardData card)
    {
        Action<CardData> cb = onCardPicked;
        Close();
        cb?.Invoke(card);
    }
}
