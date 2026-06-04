using UnityEngine;
using UnityEngine.Tilemaps;
#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
#endif

/// <summary>
/// Outil d'éditeur pour générer une map de Zone : Grid + Tilemap "Sol" + Tilemap "Murs"
/// (bordure avec collisions), à partir de sprites du tileset neo_zero.
///
/// Utilisation dans Unity :
/// 1. Crée un GameObject vide à l'origine (0,0,0), nommé "MapBuilder", et ajoute ce composant.
/// 2. Assigne "Floor Sprite" (une tuile de sol) et "Wall Sprite" (une tuile de mur) dans l'Inspector.
///    Ces sprites viennent du tileset re-découpé en grille (voir SETUP / instructions).
/// 3. Ajuste "Size In Tiles" et "Center" : le rectangle cyan (gizmo) montre l'emprise — cale-le
///    pour englober tes PNJ et la porte.
/// 4. Clic droit sur le composant -> "Build Map". (Re-clic = reconstruit proprement.)
///    "Clear Map" supprime la map générée.
///
/// L'échelle est calculée pour qu'une tuile fasse "Tile World Size" unités (0.8 par défaut,
/// soit la largeur du joueur), quelle que soit la taille en pixels de la tuile.
/// </summary>
public class MapBuilder : MonoBehaviour
{
    [Header("Sprites du tileset (après découpe en grille)")]
    [Tooltip("Tuile utilisée pour le sol (répétée sur toute la zone).")]
    [SerializeField] private Sprite floorSprite;
    [Tooltip("Tuile utilisée pour la bordure de murs (collisions). Optionnel.")]
    [SerializeField] private Sprite wallSprite;

    [Header("Dimensions")]
    [Tooltip("Taille de la map, en nombre de tuiles (largeur, hauteur).")]
    [SerializeField] private Vector2Int sizeInTiles = new Vector2Int(28, 20);
    [Tooltip("Centre de la map dans le monde.")]
    [SerializeField] private Vector2 center = Vector2.zero;
    [Tooltip("Taille d'une tuile dans le monde. Le joueur fait ~0.8 de large.")]
    [SerializeField] private float tileWorldSize = 0.8f;

    [Header("Murs")]
    [SerializeField] private bool buildWalls = true;
    [Tooltip("Épaisseur de la bordure de murs, en tuiles.")]
    [SerializeField] private int wallThickness = 1;

    [Header("Tri d'affichage (sorting order)")]
    [Tooltip("Le sol doit être derrière les personnages (qui sont à 1).")]
    [SerializeField] private int floorSortingOrder = -10;
    [SerializeField] private int wallSortingOrder = -5;

    private const string GridName = "Map";
    private const string FloorMapName = "Sol";
    private const string WallMapName = "Murs";
    private const string TileFolder = "Assets/Tiles";

    [ContextMenu("Build Map")]
    public void BuildMap()
    {
#if UNITY_EDITOR
        if (floorSprite == null)
        {
            Debug.LogError("MapBuilder : assigne un 'Floor Sprite' avant de générer la map.", this);
            return;
        }

        ClearMap();

        // --- Tiles ---
        Tile floorTile = CreateTileAsset(floorSprite, "FloorTile", Tile.ColliderType.None);
        Tile wallTile = wallSprite != null
            ? CreateTileAsset(wallSprite, "WallTile", Tile.ColliderType.Grid)
            : null;

        // --- Grid (échelle calée sur la taille native de la tuile) ---
        var gridGO = new GameObject(GridName);
        gridGO.transform.SetParent(transform, false);
        var grid = gridGO.AddComponent<Grid>();

        Vector3 nativeSize = floorSprite.bounds.size; // taille du sprite en unités (scale 1)
        grid.cellSize = new Vector3(nativeSize.x, nativeSize.y, 0f);
        float scale = nativeSize.x > 0f ? tileWorldSize / nativeSize.x : 1f;
        gridGO.transform.localScale = new Vector3(scale, scale, 1f);
        gridGO.transform.localPosition = new Vector3(center.x, center.y, 0f);

        int minX = -sizeInTiles.x / 2;
        int minY = -sizeInTiles.y / 2;
        int maxX = minX + sizeInTiles.x;   // exclusif
        int maxY = minY + sizeInTiles.y;   // exclusif

        // --- Tilemap Sol ---
        Tilemap floorMap = CreateTilemap(gridGO.transform, FloorMapName, floorSortingOrder, false);
        for (int x = minX; x < maxX; x++)
            for (int y = minY; y < maxY; y++)
                floorMap.SetTile(new Vector3Int(x, y, 0), floorTile);

        // --- Tilemap Murs (bordure) ---
        if (buildWalls && wallTile != null)
        {
            Tilemap wallMap = CreateTilemap(gridGO.transform, WallMapName, wallSortingOrder, true);
            for (int x = minX; x < maxX; x++)
            {
                for (int y = minY; y < maxY; y++)
                {
                    bool isBorder = x < minX + wallThickness || x >= maxX - wallThickness
                                 || y < minY + wallThickness || y >= maxY - wallThickness;
                    if (isBorder)
                        wallMap.SetTile(new Vector3Int(x, y, 0), wallTile);
                }
            }
        }

        EditorSceneManager.MarkSceneDirty(gameObject.scene);
        AssetDatabase.SaveAssets();
        Debug.Log($"MapBuilder : map {sizeInTiles.x}×{sizeInTiles.y} générée (centre {center}).", this);
#else
        Debug.LogWarning("MapBuilder.BuildMap ne fonctionne que dans l'éditeur Unity.");
#endif
    }

    [ContextMenu("Clear Map")]
    public void ClearMap()
    {
        Transform existing = transform.Find(GridName);
        if (existing == null) return;

#if UNITY_EDITOR
        DestroyImmediate(existing.gameObject);
        EditorSceneManager.MarkSceneDirty(gameObject.scene);
#else
        Destroy(existing.gameObject);
#endif
    }

#if UNITY_EDITOR
    private static Tile CreateTileAsset(Sprite sprite, string assetName, Tile.ColliderType colliderType)
    {
        if (!AssetDatabase.IsValidFolder(TileFolder))
            AssetDatabase.CreateFolder("Assets", "Tiles");

        string path = $"{TileFolder}/{assetName}.asset";
        Tile tile = AssetDatabase.LoadAssetAtPath<Tile>(path);
        if (tile == null)
        {
            tile = ScriptableObject.CreateInstance<Tile>();
            AssetDatabase.CreateAsset(tile, path);
        }

        tile.sprite = sprite;
        tile.colliderType = colliderType;
        EditorUtility.SetDirty(tile);
        return tile;
    }

    private static Tilemap CreateTilemap(Transform parent, string name, int sortingOrder, bool withCollider)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent, false);

        var tilemap = go.AddComponent<Tilemap>();
        var tilemapRenderer = go.AddComponent<TilemapRenderer>();
        tilemapRenderer.sortingOrder = sortingOrder;

        if (withCollider)
            go.AddComponent<TilemapCollider2D>();

        return tilemap;
    }
#endif

    private void OnDrawGizmosSelected()
    {
        Gizmos.color = Color.cyan;
        var size = new Vector3(sizeInTiles.x * tileWorldSize, sizeInTiles.y * tileWorldSize, 0f);
        Gizmos.DrawWireCube(new Vector3(center.x, center.y, 0f), size);
    }
}
